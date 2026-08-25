using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.DTOs;
using AthleteHub.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AchievementsController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public AchievementsController(AthleteHubDbContext context)
    {
        _context = context;
    }

    [Authorize(Roles = "ATHLETE")]
    [HttpGet("me")]
    public async Task<IActionResult> GetMyAchievements()
    {
        var athlete = await GetCurrentAthleteAsync();

        if (athlete == null)
        {
            return NotFound(new { message = "Athlete profile not found." });
        }

        var achievements = await _context.Achievements
            .Where(a => a.AthleteId == athlete.AthleteId)
            .OrderByDescending(a => a.AchievementDate)
            .ThenByDescending(a => a.CreatedAt)
            .Select(a => new
            {
                a.AchievementId,
                a.Title,
                a.Description,
                a.AchievementDate,
                a.Category,
                a.VerificationStatus,
                a.VerifiedAt,
                a.CreatedAt
            })
            .ToListAsync();

        return Ok(achievements);
    }

    [Authorize(Roles = "ATHLETE")]
    [HttpPost]
    public async Task<IActionResult> CreateAchievement(CreateAchievementRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Title is required." });
        }

        var athlete = await GetCurrentAthleteAsync();

        if (athlete == null)
        {
            return NotFound(new { message = "Athlete profile not found." });
        }

        var achievement = new Achievement
        {
            AthleteId = athlete.AthleteId,
            Title = request.Title.Trim(),
            Description = request.Description,
            AchievementDate = request.AchievementDate,
            Category = request.Category,
            VerificationStatus = "PENDING",
            CreatedAt = DateTime.UtcNow
        };

        _context.Achievements.Add(achievement);
        await _context.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetMyAchievements),
            new { id = achievement.AchievementId },
            new
            {
                achievement.AchievementId,
                achievement.Title,
                achievement.Description,
                achievement.AchievementDate,
                achievement.Category,
                achievement.VerificationStatus,
                achievement.CreatedAt
            });
    }

    [Authorize(Roles = "ADMIN")]
    [HttpPut("{achievementId}/verify")]
    public async Task<IActionResult> VerifyAchievement(
        int achievementId,
        [FromQuery] string status = "VERIFIED")
    {
        var normalizedStatus = status.Trim().ToUpperInvariant();

        if (normalizedStatus is not ("VERIFIED" or "REJECTED"))
        {
            return BadRequest(new { message = "Status must be VERIFIED or REJECTED." });
        }

        var achievement = await _context.Achievements
            .FirstOrDefaultAsync(a => a.AchievementId == achievementId);

        if (achievement == null)
        {
            return NotFound(new { message = "Achievement not found." });
        }

        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return Unauthorized(new { message = "User ID was not found in the JWT." });
        }

        achievement.VerificationStatus = normalizedStatus;
        achievement.VerifiedBy = userId;
        achievement.VerifiedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            achievement.AchievementId,
            achievement.VerificationStatus,
            achievement.VerifiedBy,
            achievement.VerifiedAt
        });
    }

    private async Task<AthleteProfile?> GetCurrentAthleteAsync()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return null;
        }

        var athlete = await _context.AthleteProfiles
            .FirstOrDefaultAsync(a => a.UserId == userId);

        if (athlete != null)
        {
            return athlete;
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.UserId == userId && u.RoleId == 1);

        if (user == null)
        {
            return null;
        }

        athlete = new AthleteProfile
        {
            UserId = user.UserId,
            StudentNumber = user.UniversityId
        };

        _context.AthleteProfiles.Add(athlete);
        await _context.SaveChangesAsync();

        return athlete;
    }
}