using System.Net;
using System.Text;
using System.Text.Json;
using AthleteHub.API.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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

// HTTPS redirection
app.UseHttpsRedirection();

app.UseCors("FrontendPolicy");

// Serve uploaded document files
app.UseStaticFiles();

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

// ==========================================
// START APPLICATION
// ==========================================

app.Run();