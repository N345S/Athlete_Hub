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

// Hosting platforms show the database as one URL (mysql://user:password@host:port/database); accept it as is.
if (connectionString != null && connectionString.StartsWith("mysql://", StringComparison.OrdinalIgnoreCase))
{
    var url = new Uri(connectionString.Trim());
    var credentials = url.UserInfo.Split(':', 2);
    connectionString = new MySql.Data.MySqlClient.MySqlConnectionStringBuilder
    {
        Server = url.Host,
        Port = (uint)(url.IsDefaultPort ? 3306 : url.Port),
        Database = Uri.UnescapeDataString(url.AbsolutePath.TrimStart('/')),
        UserID = Uri.UnescapeDataString(credentials[0]),
        Password = credentials.Length > 1 ? Uri.UnescapeDataString(credentials[1]) : ""
    }.ConnectionString;
}

builder.Services.AddDbContext<AthleteHubDbContext>(options =>
    options.UseMySQL(connectionString!));


// ==========================================
// CONTROLLERS
// ==========================================

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new UtcTimestampConverter());
    })
    // A form that fails validation gets one plain sentence, like every other error, instead of ASP.NET's details.
    .ConfigureApiBehaviorOptions(options => options.InvalidModelStateResponseFactory = context =>
        new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(new { message = ValidationMessages.Describe(context.ModelState) }));

builder.Services.AddScoped<AthleteAccessService>();
builder.Services.AddScoped<AchievementReviewService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<IctdUniversityDatabase>();
builder.Services.AddScoped<CoachEvaluationService>();
builder.Services.AddScoped<IctdGradeSync>();
// One instance, so the Director dashboard can read when the ICTD database was last checked.
builder.Services.AddSingleton<IctdGradeSyncWorker>();
builder.Services.AddHostedService(services => services.GetRequiredService<IctdGradeSyncWorker>());
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
                "http://127.0.0.1:5174",
                // Expo's web preview of the mobile app (npm run web in mobile/).
                "http://localhost:8081",
                "http://127.0.0.1:8081"
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

// HS256 needs a key of at least 256 bits; a shorter one only fails later, on every sign-in, as a bare 500.
if (jwtKey == null || jwtKey == "__SET_IN_USER_SECRETS__" || Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    var found = string.IsNullOrEmpty(jwtKey) || jwtKey == "__SET_IN_USER_SECRETS__" ? "it is not set" : $"it has {jwtKey.Length} characters";
    throw new InvalidOperationException(
        $"Jwt:Key must be set to a random string of at least 32 characters, but {found} (on a hosted deployment: the Jwt__Key variable).");
}

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

        // Suspending or deactivating an account, or hiding its role, takes effect immediately, not when the token expires.
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var userId = AthleteAccessService.GetUserId(context.Principal!);
                var db = context.HttpContext.RequestServices.GetRequiredService<AthleteHubDbContext>();
                var active = userId != null && await db.Users.AnyAsync(user => user.UserId == userId && user.AccountStatus == "ACTIVE"
                    && !HiddenRoles.Names.Contains(user.Role.RoleName));
                if (!active) context.Fail("This account is no longer active.");
            }
        };
    });


// ==========================================
// AUTHORIZATION
// ==========================================

// Grades and accounts need the director's password again; see SensitiveAccess.
builder.Services.AddAuthorization(options => options.AddPolicy(SensitiveAccess.Policy,
    policy => policy.RequireAssertion(context => SensitiveAccess.IsSatisfied(context.User))));


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
            message = "Something went wrong on our side. Please try again in a moment.",
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

// Hosted deployments (see Dockerfile) sit behind the platform's HTTPS proxy, whose address is not known in advance.
// Only the last X-Forwarded-For entry is used: the proxy appends it, so a client cannot spoof it.
if (builder.Configuration.GetValue<bool>("App:BehindProxy"))
{
    forwardedHeaders.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    forwardedHeaders.ForwardLimit = 1;
    forwardedHeaders.KnownIPNetworks.Clear();
    forwardedHeaders.KnownProxies.Clear();
}
app.UseForwardedHeaders(forwardedHeaders);

// HTTPS redirection
app.UseHttpsRedirection();

// Hosted deployments serve the built web app from the same address as the API (the Dockerfile copies web/dist
// into client/). It is a separate folder from wwwroot so old uploads there can never become public.
var clientDirectory = Path.Combine(app.Environment.ContentRootPath, "client");
if (Directory.Exists(clientDirectory))
{
    var clientFiles = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(clientDirectory);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = clientFiles });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = clientFiles });
}

app.UseCors("FrontendPolicy");

// Uploaded files are never served statically; they go through authorized API endpoints.
app.UseRateLimiter();

// JWT authentication
app.UseAuthentication();

// Authorization
app.UseAuthorization();

// Map controller routes
app.MapControllers();

// Say which database is used (never the password), so a hosted deployment that did not receive its
// connection string is obvious in the log instead of failing with a bare "connection refused".
var database = new MySql.Data.MySqlClient.MySqlConnectionStringBuilder(connectionString);
app.Logger.LogInformation("Database: {Server}:{Port}/{Database} as {User}", database.Server, database.Port, database.Database, database.UserID);
if (database.Password == "__SET_IN_USER_SECRETS__")
{
    app.Logger.LogCritical("The database password is the placeholder from appsettings.json: ConnectionStrings__DefaultConnection is not set for this environment.");
}

// Apply pending schema changes, including performance measurement units.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AthleteHubDbContext>();
    db.Database.Migrate();
}

app.Services.GetRequiredService<DocumentStorage>().MoveLegacyFilesToPrivateStorage();

// A forgotten Grades/Accounts password: `dotnet run -- --reset-page-password director@school.edu` clears it, and the
// director sets up a new one the next time they open those pages. Works in every environment, then exits.
var resetPagePassword = Array.IndexOf(args, "--reset-page-password");
if (resetPagePassword >= 0)
{
    var email = resetPagePassword + 1 < args.Length ? args[resetPagePassword + 1].Trim().ToLowerInvariant() : string.Empty;
    using var resetScope = app.Services.CreateScope();
    var cleared = await resetScope.ServiceProvider.GetRequiredService<AthleteHubDbContext>().Users
        .Where(user => user.Email.ToLower() == email)
        .ExecuteUpdateAsync(setters => setters.SetProperty(user => user.ConfidentialPasswordHash, (string?)null));
    Console.WriteLine(cleared > 0
        ? $"The Grades and Accounts password for {email} was cleared. They will make a new one the next time they open those pages."
        : $"No account uses the email \"{email}\".");
    return;
}

// Development helpers, which exit when done: `dotnet run -- --reset-demo-data` deletes ALL data and creates the demo
// data; `--wipe-all-data` only deletes (a hosted API with App:SeedTestDataIfEmpty then refills itself on its next
// start, writing the sample files to its own storage).
if (args.Contains("--reset-demo-data") || args.Contains("--wipe-all-data"))
{
    if (!app.Environment.IsDevelopment())
    {
        Console.Error.WriteLine("Demo data commands only run in the Development environment.");
        return;
    }

    using var seedScope = app.Services.CreateScope();
    var seeder = NewDemoSeeder(seedScope.ServiceProvider);
    await seeder.WipeAsync();
    if (args.Contains("--reset-demo-data")) await seeder.SeedAsync();
    return;
}

// One-time switch for a hosted database that still holds older data and cannot be reached from a PC: set
// App__ResetToDemoData=yes and restart. Everything is deleted and the demo data created, unless the demo data is
// already there, so later restarts leave it alone. Remove the variable afterwards.
if (string.Equals(builder.Configuration["App:ResetToDemoData"], "yes", StringComparison.OrdinalIgnoreCase))
{
    using var resetScope = app.Services.CreateScope();
    var seeder = NewDemoSeeder(resetScope.ServiceProvider);
    if (await seeder.HasDemoDataAsync())
    {
        app.Logger.LogWarning("App:ResetToDemoData is set, but the demo data is already there, so nothing was deleted. Remove the variable.");
    }
    else
    {
        app.Logger.LogWarning("App:ResetToDemoData is set: deleting all data and creating the demo data.");
        await seeder.WipeAsync();
        await seeder.SeedAsync();
        app.Logger.LogWarning("Demo data created. Remove App__ResetToDemoData.");
    }
}

// Hosted deployments set App:SeedTestDataIfEmpty so a start with an empty database (no accounts at all) fills it
// with the demo data and its sample files in private-uploads. A database with any account is left as it is.
if (builder.Configuration.GetValue<bool>("App:SeedTestDataIfEmpty"))
{
    using var seedScope = app.Services.CreateScope();
    var seeder = NewDemoSeeder(seedScope.ServiceProvider);
    if (await seeder.IsEmptyAsync()) await seeder.SeedAsync();
}

// ==========================================
// START APPLICATION
// ==========================================

app.Run();

DemoDataSeeder NewDemoSeeder(IServiceProvider services) => new(
    services.GetRequiredService<AthleteHubDbContext>(),
    services.GetRequiredService<AppClock>(),
    app.Environment,
    services.GetRequiredService<IctdGradeSync>());