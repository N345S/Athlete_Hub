using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using AthleteHub.API.Data;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// ==========================================
// DATABASE CONNECTION
// ==========================================

var connectionString = builder.Configuration
    .GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<AthleteHubDbContext>(options =>
    options.UseMySQL(connectionString!));


// ==========================================
// CONTROLLERS
// ==========================================

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });

builder.Services.AddScoped<AthleteAccessService>();
builder.Services.AddScoped<AchievementReviewService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddSingleton<DocumentStorage>();
builder.Services.AddSingleton<AppClock>();

// Limit repeated sign-in attempts per client to slow down password guessing.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:8000",
                "http://127.0.0.1:8000",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5174"
            )
            .WithHeaders("Authorization", "Content-Type", "Accept", "X-Requested-With")
            .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS");
    });
});


// ==========================================
// JWT AUTHENTICATION
// ==========================================

var jwtKey = builder.Configuration["Jwt:Key"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"];
var jwtAudience = builder.Configuration["Jwt:Audience"];

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            // Validate the secret key used to sign the JWT
            ValidateIssuerSigningKey = true,

            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey!)
            ),

            // Validate issuer
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,

            // Validate audience
            ValidateAudience = true,
            ValidAudience = jwtAudience,

            // Validate token expiration
            ValidateLifetime = true,

            // No extra time after token expiration
            ClockSkew = TimeSpan.Zero
        };

        // Suspending or deactivating an account takes effect immediately, not when the token expires.
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var userId = AthleteAccessService.GetUserId(context.Principal!);
                var db = context.HttpContext.RequestServices.GetRequiredService<AthleteHubDbContext>();
                var active = userId != null && await db.Users.AnyAsync(user => user.UserId == userId && user.AccountStatus == "ACTIVE");
                if (!active) context.Fail("This account is no longer active.");
            }
        };
    });


// ==========================================
// AUTHORIZATION
// ==========================================

builder.Services.AddAuthorization();


// ==========================================
// OPENAPI
// ==========================================

builder.Services.AddOpenApi();


// ==========================================
// BUILD APPLICATION
// ==========================================

var app = builder.Build();


// ==========================================
// GLOBAL EXCEPTION HANDLING
// ==========================================

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
        context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
        context.Response.ContentType = "application/json";
        
        var response = new
        {
            message = "An internal server error occurred",
            detail = app.Environment.IsDevelopment() ? ex.Message : null
        };
        
        await context.Response.WriteAsync(JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        }));
    }
});


// ==========================================
// DEVELOPMENT / OPENAPI
// ==========================================

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}


// ==========================================
// HTTP REQUEST PIPELINE
// ==========================================

// The web server forwards /api from this machine (vite.config.js) so phones can use the app. Trust its
// X-Forwarded-For header from loopback only, so per-device limits such as the login rate limit still apply.
var forwardedHeaders = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor, ForwardLimit = 2 };
forwardedHeaders.KnownProxies.Add(IPAddress.Loopback);
forwardedHeaders.KnownProxies.Add(IPAddress.IPv6Loopback);
app.UseForwardedHeaders(forwardedHeaders);

// HTTPS redirection
app.UseHttpsRedirection();

app.UseCors("FrontendPolicy");

// Uploaded files are never served statically; they go through authorized API endpoints.
app.UseRateLimiter();

// JWT authentication
app.UseAuthentication();

// Authorization
app.UseAuthorization();

// Map controller routes
app.MapControllers();

// Apply pending schema changes, including performance measurement units.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AthleteHubDbContext>();
    db.Database.Migrate();
}

app.Services.GetRequiredService<DocumentStorage>().MoveLegacyFilesToPrivateStorage();

// Development helpers: `dotnet run -- --seed-test-data` / `--remove-test-data` / `--seed-parents` manage scenario data, then exit.
if (args.Contains("--seed-test-data") || args.Contains("--remove-test-data") || args.Contains("--seed-parents"))
{
    if (!app.Environment.IsDevelopment())
    {
        Console.Error.WriteLine("Test data commands only run in the Development environment.");
        return;
    }

    using var seedScope = app.Services.CreateScope();
    var seeder = new TestDataSeeder(
        seedScope.ServiceProvider.GetRequiredService<AthleteHubDbContext>(),
        seedScope.ServiceProvider.GetRequiredService<AppClock>(),
        app.Environment);
    if (args.Contains("--remove-test-data")) await seeder.RemoveAsync();
    else if (args.Contains("--seed-parents")) await seeder.SeedParentsAsync();
    else await seeder.SeedAsync();
    return;
}

// ==========================================
// START APPLICATION
// ==========================================

app.Run();