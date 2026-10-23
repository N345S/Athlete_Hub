using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.DTOs;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AchievementsController : ControllerBase
{
    private readonly AthleteHubDbContext _context;
    private readonly AthleteAccessService _access;
    private readonly AchievementReviewService _review;
    private readonly DocumentStorage _storage;

    public AchievementsController(
        AthleteHubDbContext context,
        AthleteAccessService access,
        AchievementReviewService review,
        DocumentStorage storage)
    {
        _context = context;
        _access = access;
        _review = review;
        _storage = storage;
    }

    [Authorize(Roles = "ATHLETE")]
    [HttpGet("me")]
    public async Task<IActionResult> GetMyAchievements()
    {
        var athlete = await GetCurrentAthleteAsync();

        if (athlete == null)
        {
            return NotFound(new { message = "We could not find this student-athlete." });
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
                a.RejectionReason,
                a.VerifiedAt,
                a.CreatedAt
            })
            .ToListAsync();

        return Ok(achievements.Select(achievement => new
        {
            achievement.AchievementId,
            achievement.Title,
            achievement.Description,
            achievementDate = achievement.AchievementDate.HasValue ? achievement.AchievementDate.Value.ToString("yyyy-MM-dd") : null,
            achievement.Category,
            achievement.VerificationStatus,
            achievement.RejectionReason,
            achievement.VerifiedAt,
            achievement.CreatedAt
        }));
    }

    [Authorize(Roles = "ATHLETE")]
    [HttpPost]
    public async Task<IActionResult> CreateAchievement(CreateAchievementRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > 200)
        {
            return BadRequest(new { message = "Please enter a title (200 characters at most)." });
        }

        var athlete = await GetCurrentAthleteAsync();

        if (athlete == null)
        {
            return NotFound(new { message = "We could not find this student-athlete." });
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
                achievementDate = achievement.AchievementDate.HasValue ? achievement.AchievementDate.Value.ToString("yyyy-MM-dd") : null,
                achievement.Category,
                achievement.VerificationStatus,
                achievement.CreatedAt
            });
    }

    [Authorize(Roles = "ATHLETE,STUDENT")]
    [HttpDelete("{achievementId}")]
    public async Task<IActionResult> DeleteAchievement(int achievementId)
    {
        var athlete = await GetCurrentAthleteAsync();
        var achievement = athlete == null
            ? null
            : await _context.Achievements.FirstOrDefaultAsync(item =>
                item.AchievementId == achievementId && item.AthleteId == athlete.AthleteId);

        if (achievement == null)
        {
            return NotFound(new { message = "We could not find this achievement. It may have been deleted." });
        }

        if (string.Equals(achievement.VerificationStatus, "VERIFIED", StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new { message = "This achievement is already approved, so you cannot remove it. Ask your coach for help." });
        }

        var evidence = await _context.Documents.Where(document => document.AchievementId == achievementId).ToListAsync();
        _context.Documents.RemoveRange(evidence);
        _context.PortfolioItems.RemoveRange(_context.PortfolioItems.Where(item => item.AchievementId == achievementId));
        _context.Achievements.Remove(achievement);
        await _context.SaveChangesAsync();
        foreach (var document in evidence) _storage.Delete(document.FileUrl);
        return NoContent();
    }

    [Authorize(Roles = "COACH")]
    [HttpPut("{achievementId}/verify")]
    public async Task<IActionResult> VerifyAchievement(
        int achievementId,
        [FromBody] AchievementVerificationRequest request)
    {
        var normalizedStatus = AchievementReviewService.NormalizeStatus(request.Status);

        if (normalizedStatus == null)
        {
            return BadRequest(new { message = "Please choose Approve or Reject." });
        }

        if (normalizedStatus == "REJECTED" && string.IsNullOrWhiteSpace(request.RejectionReason))
        {
            return BadRequest(new { message = "Please write why you are rejecting it." });
        }

        var achievement = await _context.Achievements
            .Include(a => a.Athlete)
            .FirstOrDefaultAsync(a => a.AchievementId == achievementId);

        if (achievement == null)
        {
            return NotFound(new { message = "We could not find this achievement. It may have been deleted." });
        }

        if (!await _access.CanViewAthleteAsync(User, achievement.AthleteId, includeRegistrar: false))
        {
            return Forbid();
        }

        var userId = AthleteAccessService.GetUserId(User);
        if (userId == null)
        {
            return Unauthorized(new { message = "You have been signed out. Please sign in again." });
        }

        await _review.ApplyAsync(achievement, normalizedStatus, request.RejectionReason, userId.Value, User.FindFirstValue(ClaimTypes.Role) ?? "");
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

        // Older athlete accounts may predate automatic profile creation.
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.UserId == userId && u.Role.RoleName == "ATHLETE");

        if (user == null)
        {
            return null;
        }

        athlete = new AthleteProfile
        {
            UserId = user.UserId,
            StudentNumber = user.UniversityId ?? $"ATH-{user.UserId}"
        };

        _context.AthleteProfiles.Add(athlete);
        await _context.SaveChangesAsync();

        return athlete;
    }
}