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
                message = "User ID was not found in the JWT."
            });
        }

        // Convert User ID from string to integer
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new
            {
                message = "Invalid User ID in JWT."
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
                message = "Athlete profile not found.",
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

            birthDate = athlete.BirthDate,

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
            message = "User ID was not found in the JWT."
        });
    }

    if (!int.TryParse(userIdClaim, out int userId))
    {
        return Unauthorized(new
        {
            message = "Invalid User ID in JWT."
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
            message = "Athlete profile not found.",
            userId = userId
        });
    }


    // Update athlete profile
    athlete.Course = request.Course;
    athlete.YearLevel = request.YearLevel;
    athlete.BirthDate = request.BirthDate;
    athlete.ProfilePhotoUrl = request.ProfilePhotoUrl;


    // Update phone number in Users table
    athlete.User.Phone = request.Phone;

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

        birthDate = athlete.BirthDate,

        profilePhotoUrl = athlete.ProfilePhotoUrl,

        phone = athlete.User.Phone
    });
}
}