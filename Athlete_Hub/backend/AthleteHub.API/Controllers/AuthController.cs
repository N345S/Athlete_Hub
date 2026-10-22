using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AthleteHub.API.Data;
using AthleteHub.API.DTOs;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace AthleteHub.API.Controllers;

/// <summary>
/// Authentication controller for user registration, login, and token validation.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    // Verified when the email is unknown so failed sign-ins take the same time either way.
    private static readonly string UnknownUserPasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString());

    private readonly AthleteHubDbContext _context;
    private readonly IConfiguration _configuration;

    /// <summary>
    /// Initializes a new instance of the <see cref="AuthController"/> class.
    /// </summary>
    /// <param name="context">The database context.</param>
    /// <param name="configuration">The application configuration.</param>
    public AuthController(
        AthleteHubDbContext context,
        IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }


    /// <summary>
    /// Registers a new athlete account.
    /// </summary>
    /// <param name="request">The registration request containing athlete details.</param>
    /// <returns>Success message with user details or validation errors.</returns>
    /// <response code="200">Account registered successfully.</response>
    /// <response code="400">University ID or email already exists, or ATHLETE role not found.</response>
    /// <response code="500">Internal server error.</response>
    [HttpPost("register")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        request.Email = request.Email.Trim().ToLowerInvariant();
        request.UniversityId = request.UniversityId.Trim();

        // Check if University ID already exists
        var existingUniversityId = await _context.Users
            .AnyAsync(u => u.UniversityId == request.UniversityId);

        if (existingUniversityId)
        {
            return BadRequest(new
            {
                message = "University ID is already registered."
            });
        }

        // Check if email already exists
        var existingEmail = await _context.Users
            .AnyAsync(u => u.Email == request.Email);

        if (existingEmail)
        {
            return BadRequest(new
            {
                message = "Email is already registered."
            });
        }

        // Find ATHLETE role
        var athleteRole = await _context.Roles
            .FirstOrDefaultAsync(r => r.RoleName == "ATHLETE");

        if (athleteRole == null)
        {
            return StatusCode(500, new
            {
                message = "ATHLETE role was not found in the database."
            });
        }

        // Create user
        var user = new User
        {
            RoleId = athleteRole.RoleId,

            UniversityId = request.UniversityId,

            Email = request.Email,

            // Hash password before saving
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(
                request.Password
            ),

            FirstName = request.FirstName.Trim(),

            MiddleName = request.MiddleName,

            LastName = request.LastName.Trim(),

            Phone = request.Phone,

            AccountStatus = "ACTIVE",

            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);

        await _context.SaveChangesAsync();

        _context.AthleteProfiles.Add(new AthleteProfile
        {
            UserId = user.UserId,
            StudentNumber = user.UniversityId
        });

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Athlete account successfully registered.",
            userId = user.UserId,
            universityId = user.UniversityId,
            email = user.Email,
            role = athleteRole.RoleName
        });
    }


    /// <summary>
    /// Authenticates a user and returns a JWT token.
    /// </summary>
    /// <param name="request">The login request containing email and password.</param>
    /// <returns>JWT token with user claims or authentication error.</returns>
    /// <response code="200">Login successful with JWT token.</response>
    /// <response code="401">Invalid email, password, or inactive account.</response>
    /// <response code="500">JWT key not configured.</response>
    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        // Find user by email
        var normalizedEmail = request.Email?.Trim().ToLowerInvariant();
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

        // Always verify a hash so unknown emails and wrong passwords are indistinguishable.
        var passwordValid = BCrypt.Net.BCrypt.Verify(
            request.Password,
            user?.PasswordHash ?? UnknownUserPasswordHash
        );

        if (user == null || !passwordValid)
        {
            return Unauthorized(new
            {
                message = "Invalid email or password."
            });
        }

        // Account status is only revealed once the password has been proven.
        if (user.AccountStatus != "ACTIVE")
        {
            return Unauthorized(new
            {
                message = $"This account is {user.AccountStatus.ToLowerInvariant()}. Please contact the athletics office or the Sports Director."
            });
        }

        if (user.Role == null)
        {
            return StatusCode(500, new { message = "This account is missing a valid role assignment." });
        }

        if (HiddenRoles.Contains(user.Role.RoleName))
        {
            return Unauthorized(new
            {
                message = "This role is no longer used in Athlete-Hub. Please contact the Sports Director."
            });
        }


        // ==========================================
        // JWT CONFIGURATION
        // ==========================================

        var jwtKey = _configuration["Jwt:Key"];
        var jwtIssuer = _configuration["Jwt:Issuer"];
        var jwtAudience = _configuration["Jwt:Audience"];

        if (string.IsNullOrEmpty(jwtKey))
        {
            return StatusCode(500, new
            {
                message = "JWT key is not configured."
            });
        }


        // ==========================================
        // JWT CLAIMS
        // ==========================================

        var claims = new List<Claim>
        {
            // User ID
            new Claim(
                ClaimTypes.NameIdentifier,
                user.UserId.ToString()
            ),

            // Email
            new Claim(
                ClaimTypes.Name,
                user.Email
            ),

            // Role
            new Claim(
                ClaimTypes.Role,
                user.Role.RoleName
            ),

            // University ID
            new Claim(
                "UniversityId",
                user.UniversityId ?? string.Empty
            ),

            // First Name
            new Claim(
                "FirstName",
                user.FirstName
            ),

            // Last Name
            new Claim(
                "LastName",
                user.LastName
            )
        };


        // ==========================================
        // CREATE SIGNING KEY
        // ==========================================

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtKey)
        );


        // ==========================================
        // CREATE SIGNING CREDENTIALS
        // ==========================================

        var credentials = new SigningCredentials(
            key,
            SecurityAlgorithms.HmacSha256
        );


        // ==========================================
        // CREATE JWT TOKEN
        // ==========================================

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,

            // Token expires after 2 hours
            expires: DateTime.UtcNow.AddHours(2),

            signingCredentials: credentials
        );


        // Convert token to string
        var tokenString = new JwtSecurityTokenHandler()
            .WriteToken(token);


        // ==========================================
        // LOGIN RESPONSE
        // ==========================================

        return Ok(new
        {
            message = "Login successful.",

            token = tokenString,

            userId = user.UserId,

            universityId = user.UniversityId,

            email = user.Email,

            firstName = user.FirstName,

            lastName = user.LastName,

            roleId = user.RoleId,

            role = user.Role.RoleName
        });
    }


    /// <summary>
    /// Gets the current authenticated user's information from JWT claims.
    /// </summary>
    /// <returns>User information extracted from the JWT token.</returns>
    /// <response code="200">Returns user details from valid JWT.</response>
    /// <response code="401">Invalid or missing JWT token.</response>
    [Authorize]
    [HttpGet("me")]
    public IActionResult GetCurrentUser()
    {
        // Get information from JWT claims
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        var email = User.FindFirstValue(
            ClaimTypes.Name
        );

        var role = User.FindFirstValue(
            ClaimTypes.Role
        );

        var universityId = User.FindFirstValue(
            "UniversityId"
        );

        var firstName = User.FindFirstValue(
            "FirstName"
        );

        var lastName = User.FindFirstValue(
            "LastName"
        );


        // Return information from authenticated user
        return Ok(new
        {
            message = "JWT authentication successful.",

            userId,

            universityId,

            email,

            firstName,

            lastName,

            role
        });
    }
}