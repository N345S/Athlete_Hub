using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AthleteProfileController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public AthleteProfileController(AthleteHubDbContext context)
    {
        _context = context;
    }


    // ==========================================
    // GET CURRENT ATHLETE PROFILE
    // GET: /api/AthleteProfile/me
    // ==========================================

    [Authorize(Roles = "ATHLETE")]
    [HttpGet("me")]
    public async Task<IActionResult> GetMyProfile()
    {
        // Get User ID from JWT
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        // Make sure User ID exists in the JWT
        if (string.IsNullOrEmpty(userIdClaim))
        {
            return Unauthorized(new
            {
                message = "You have been signed out. Please sign in again."
            });
        }

        // Convert User ID from string to integer
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new
            {
                message = "You have been signed out. Please sign in again."
            });
        }


        // Find the athlete profile belonging
        // to the currently authenticated user
        var athlete = await _context.AthleteProfiles
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.UserId == userId);


        // No athlete profile found
        if (athlete == null)
        {
            return NotFound(new
            {
                message = "We could not find this student-athlete.",
                userId = userId
            });
        }


        // Return athlete profile
        return Ok(new
        {
            endpoint = "GET /api/AthleteProfile/me",

            message = "Athlete profile retrieved successfully.",

            athleteId = athlete.AthleteId,

            userId = athlete.UserId,

            studentNumber = athlete.StudentNumber,

            firstName = athlete.User.FirstName,

            middleName = athlete.User.MiddleName,

            lastName = athlete.User.LastName,

            email = athlete.User.Email,

            phone = athlete.User.Phone,

            course = athlete.Course,

            yearLevel = athlete.YearLevel,

            birthDate = athlete.BirthDate.HasValue ? athlete.BirthDate.Value.ToString("yyyy-MM-dd") : null,

            profilePhotoUrl = athlete.ProfilePhotoUrl,

            accountStatus = athlete.User.AccountStatus
        });
    }
    // ==========================================
// UPDATE CURRENT ATHLETE PROFILE
// PUT: /api/AthleteProfile/me
// ==========================================

[Authorize(Roles = "ATHLETE")]
[HttpPut("me")]
public async Task<IActionResult> UpdateMyProfile(
    UpdateAthleteProfileRequest request)
{
    // Get User ID from JWT
    var userIdClaim = User.FindFirstValue(
        ClaimTypes.NameIdentifier
    );

    if (string.IsNullOrEmpty(userIdClaim))
    {
        return Unauthorized(new
        {
            message = "You have been signed out. Please sign in again."
        });
    }

    if (!int.TryParse(userIdClaim, out int userId))
    {
        return Unauthorized(new
        {
            message = "You have been signed out. Please sign in again."
        });
    }


    // Find the athlete profile belonging
    // to the authenticated user
    var athlete = await _context.AthleteProfiles
        .Include(a => a.User)
        .FirstOrDefaultAsync(a => a.UserId == userId);

    if (athlete == null)
    {
        return NotFound(new
        {
            message = "We could not find this student-athlete.",
            userId = userId
        });
    }


    // Update athlete profile
    if (!string.IsNullOrWhiteSpace(request.ProfilePhotoUrl)
        && !(Uri.TryCreate(request.ProfilePhotoUrl.Trim(), UriKind.Absolute, out var photoUri)
            && (photoUri.Scheme == Uri.UriSchemeHttps || photoUri.Scheme == Uri.UriSchemeHttp)))
    {
        return BadRequest(new { message = "The photo link must start with http:// or https://." });
    }

    if (request.BirthDate.HasValue && request.BirthDate.Value.Date >= DateTime.UtcNow.Date)
    {
        return BadRequest(new { message = "The birth date must be before today." });
    }

    athlete.Course = string.IsNullOrWhiteSpace(request.Course) ? null : request.Course.Trim();
    athlete.YearLevel = request.YearLevel;
    athlete.BirthDate = request.BirthDate?.Date;
    if (request.ProfilePhotoUrl != null)
    {
        athlete.ProfilePhotoUrl = string.IsNullOrWhiteSpace(request.ProfilePhotoUrl) ? null : request.ProfilePhotoUrl.Trim();
    }


    // Update phone number in Users table
    athlete.User.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();

    // Save changes
    await _context.SaveChangesAsync();


    return Ok(new
    {
        endpoint = "PUT /api/AthleteProfile/me",

        message = "Athlete profile updated successfully.",

        athleteId = athlete.AthleteId,

        userId = athlete.UserId,

        studentNumber = athlete.StudentNumber,

        course = athlete.Course,

        yearLevel = athlete.YearLevel,

        birthDate = athlete.BirthDate.HasValue ? athlete.BirthDate.Value.ToString("yyyy-MM-dd") : null,

        profilePhotoUrl = athlete.ProfilePhotoUrl,

        phone = athlete.User.Phone
    });
}
}