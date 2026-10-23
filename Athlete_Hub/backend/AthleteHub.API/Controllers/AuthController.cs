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
                message = "Someone already uses this University ID."
            });
        }

        // Check if email already exists
        var existingEmail = await _context.Users
            .AnyAsync(u => u.Email == request.Email);

        if (existingEmail)
        {
            return BadRequest(new
            {
                message = "Someone already uses this email."
            });
        }

        // Find ATHLETE role
        var athleteRole = await _context.Roles
            .FirstOrDefaultAsync(r => r.RoleName == "ATHLETE");

        if (athleteRole == null)
        {
            return StatusCode(500, new
            {
                message = "Sign-up is not working right now. Please contact the athletics office."
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
                message = "Your email or password is wrong. Please check both and try again."
            });
        }

        // Account status is only revealed once the password has been proven.
        if (user.AccountStatus != "ACTIVE")
        {
            return Unauthorized(new
            {
                message = $"Your account is {user.AccountStatus.ToLowerInvariant()}, so you cannot sign in. Please contact the athletics office or the Sports Director."
            });
        }

        if (user.Role == null)
        {
            return StatusCode(500, new { message = "Your account is not set up correctly. Please contact the Sports Director." });
        }

        if (HiddenRoles.Contains(user.Role.RoleName))
        {
            return Unauthorized(new
            {
                message = "This kind of account is no longer used. Please contact the Sports Director."
            });
        }


        // ==========================================
        // JWT CONFIGURATION
        // ==========================================

        var jwtKey = _configuration["Jwt:Key"];
        if (string.IsNullOrEmpty(jwtKey))
        {
            return StatusCode(500, new
            {
                message = "Signing in is not working right now. Please try again later or contact the athletics office."
            });
        }


        // Token expires after 2 hours
        var tokenString = CreateToken(user, user.Role.RoleName, DateTime.UtcNow.AddHours(2));


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

    /// <summary>
    /// Whether the Sports Director has set up the separate password for the confidential pages (Grades and Accounts).
    /// </summary>
    [Authorize(Roles = "DIRECTOR")]
    [HttpGet("confidential-password")]
    public async Task<IActionResult> GetConfidentialPassword()
    {
        var userId = AthleteAccessService.GetUserId(User);
        var isSet = await _context.Users.AnyAsync(u => u.UserId == userId && u.ConfidentialPasswordHash != null);
        return Ok(new { isSet });
    }

    /// <summary>
    /// Sets up the confidential-page password the first time. The sign-in password proves it is really the director,
    /// so someone using a computer they left signed in cannot set it. Opens the pages straight away.
    /// </summary>
    /// <response code="400">Wrong sign-in password, or the new password is too short or the same as the sign-in one.</response>
    /// <response code="409">A password is already set up; use the change endpoint.</response>
    [Authorize(Roles = "DIRECTOR")]
    [HttpPost("confidential-password")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> SetUpConfidentialPassword(SetUpConfidentialPasswordRequest request)
    {
        var user = await CurrentUserAsync();
        if (user?.Role == null) return Unauthorized(new { message = "You have been signed out. Please sign in again." });
        if (user.ConfidentialPasswordHash != null)
        {
            return Conflict(new { message = "You already have a password for these pages. Use it to open them." });
        }
        if (!BCrypt.Net.BCrypt.Verify(request.SignInPassword ?? string.Empty, user.PasswordHash))
        {
            return BadRequest(new { message = "Your sign-in password is wrong. Please try again." });
        }

        var problem = CheckNewConfidentialPassword(request.NewPassword, user);
        if (problem != null) return BadRequest(new { message = problem });

        user.ConfidentialPasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _context.SaveChangesAsync();
        return Ok(UnlockedResponse(user));
    }

    /// <summary>Replaces the confidential-page password after the current one is entered, and opens the pages.</summary>
    [Authorize(Roles = "DIRECTOR")]
    [HttpPut("confidential-password")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> ChangeConfidentialPassword(ChangeConfidentialPasswordRequest request)
    {
        var user = await CurrentUserAsync();
        if (user?.Role == null) return Unauthorized(new { message = "You have been signed out. Please sign in again." });
        if (user.ConfidentialPasswordHash == null)
        {
            return BadRequest(new { message = "You have not made a password for these pages yet.", code = "NOT_SET_UP" });
        }
        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword ?? string.Empty, user.ConfidentialPasswordHash))
        {
            return BadRequest(new { message = "Your current page password is wrong. Please try again." });
        }

        var problem = CheckNewConfidentialPassword(request.NewPassword, user);
        if (problem != null) return BadRequest(new { message = problem });

        user.ConfidentialPasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _context.SaveChangesAsync();
        return Ok(UnlockedResponse(user));
    }

    /// <summary>
    /// Checks the confidential-page password and returns a short-lived token that the Grades and Accounts
    /// endpoints accept (see <see cref="SensitiveAccess"/>).
    /// </summary>
    /// <response code="200">Password confirmed; returns the token and when it expires.</response>
    /// <response code="400">Wrong password, or none set up yet (code NOT_SET_UP). Not 401, which would sign the user out.</response>
    [Authorize(Roles = "DIRECTOR")]
    [HttpPost("unlock")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Unlock(UnlockRequest request)
    {
        var user = await CurrentUserAsync();
        if (user?.Role == null) return Unauthorized(new { message = "You have been signed out. Please sign in again." });
        if (user.ConfidentialPasswordHash == null)
        {
            return BadRequest(new { message = "Please make a password for these pages first.", code = "NOT_SET_UP" });
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password ?? string.Empty, user.ConfidentialPasswordHash))
        {
            return BadRequest(new { message = "That password is wrong. Please try again." });
        }

        return Ok(UnlockedResponse(user));
    }

    private Task<User?> CurrentUserAsync()
    {
        var userId = AthleteAccessService.GetUserId(User);
        return _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.UserId == userId);
    }

    /// <summary>Null when the new confidential-page password is acceptable, otherwise what is wrong with it.</summary>
    private static string? CheckNewConfidentialPassword(string? password, User user)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
            return "The new password must have at least 8 characters.";
        if (BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return "Please choose a password that is different from your sign-in password.";
        return null;
    }

    /// <summary>A token that also opens the confidential pages, for <see cref="SensitiveAccess.Lifetime"/>.</summary>
    private object UnlockedResponse(User user)
    {
        // Never outlive the sign-in it was unlocked from.
        var expires = DateTime.UtcNow.Add(SensitiveAccess.Lifetime);
        if (long.TryParse(User.FindFirstValue("exp"), out var sessionExpiry))
        {
            var sessionExpires = DateTimeOffset.FromUnixTimeSeconds(sessionExpiry).UtcDateTime;
            if (sessionExpires < expires) expires = sessionExpires;
        }

        return new
        {
            token = CreateToken(user, user.Role.RoleName, expires, sensitive: true),
            expiresAt = expires,
            // Clients count down from this rather than comparing expiresAt with their own, possibly wrong, clock.
            expiresInSeconds = (int)(expires - DateTime.UtcNow).TotalSeconds
        };
    }


    /// <summary>
    /// Signs a token for the user. A <paramref name="sensitive"/> token also opens confidential pages; see
    /// <see cref="SensitiveAccess"/>.
    /// </summary>
    private string CreateToken(User user, string roleName, DateTime expires, bool sensitive = false)
    {
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
                roleName
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


        if (sensitive)
        {
            claims.Add(new Claim(SensitiveAccess.ClaimType, "true"));
        }


        // ==========================================
        // CREATE SIGNING KEY
        // ==========================================

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!)
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
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,

            expires: expires,

            signingCredentials: credentials
        );


        // Convert token to string
        return new JwtSecurityTokenHandler()
            .WriteToken(token);
    }
}

public sealed class UnlockRequest
{
    public string? Password { get; set; }
}

public sealed class SetUpConfidentialPasswordRequest
{
    public string? SignInPassword { get; set; }

    public string? NewPassword { get; set; }
}

public sealed class ChangeConfidentialPasswordRequest
{
    public string? CurrentPassword { get; set; }

    public string? NewPassword { get; set; }
}
