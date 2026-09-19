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
[Authorize]
public class PortfolioController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public PortfolioController(AthleteHubDbContext context)
    {
        _context = context;
    }

    [HttpGet("me")]
    [Authorize(Roles = "ATHLETE,STUDENT")]
    public async Task<IActionResult> GetMyPortfolio()
    {
        var athlete = await GetCurrentAthleteAsync();

        if (athlete == null)
        {
            return NotFound(new { message = "Athlete profile not found." });
        }

        var items = await _context.PortfolioItems
            .Where(item => item.AthleteId == athlete.AthleteId)
            .Include(item => item.Achievement)
            .OrderBy(item => item.DisplayOrder)
            .ThenByDescending(item => item.CreatedAt)
            .Select(item => new
            {
                item.PortfolioItemId,
                item.AchievementId,
                item.Title,
                item.Description,
                item.DisplayOrder,
                item.IsVisible,
                item.CreatedAt,
                item.VerificationStatus,
                item.RejectionReason,
                item.VerifiedAt,
                achievementDate = item.Achievement == null ? null : item.Achievement.AchievementDate,
                achievementStatus = item.Achievement == null
                    ? null
                    : item.Achievement.VerificationStatus,
                evidence = item.Achievement == null
                    ? Array.Empty<object>()
                    : _context.Documents.Where(document => document.AchievementId == item.AchievementId)
                        .Select(document => new { document.DocumentId, document.DocumentName, document.FileUrl, document.Status })
                        .ToArray()
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("athlete/{athleteId:int}")]
    [Authorize(Roles = "COACH,DIRECTOR")]
    public async Task<IActionResult> GetAthletePortfolio(int athleteId)
    {
        if (!await CanAccessAthleteAsync(athleteId))
        {
            return Forbid();
        }

        var athlete = await _context.AthleteProfiles
            .Include(item => item.User)
            .FirstOrDefaultAsync(item => item.AthleteId == athleteId);

        if (athlete == null)
        {
            return NotFound(new { message = "Athlete profile not found." });
        }

        var items = await _context.PortfolioItems
            .Where(item => item.AthleteId == athleteId)
            .Include(item => item.Achievement)
            .OrderBy(item => item.DisplayOrder)
            .ThenByDescending(item => item.CreatedAt)
            .Select(item => new
            {
                item.PortfolioItemId,
                item.AchievementId,
                item.Title,
                item.Description,
                item.DisplayOrder,
                item.CreatedAt,
                item.VerificationStatus,
                item.RejectionReason,
                item.VerifiedAt,
                achievementDate = item.Achievement == null ? null : item.Achievement.AchievementDate,
                achievementStatus = item.Achievement == null ? null : item.Achievement.VerificationStatus,
                evidence = item.Achievement == null
                    ? Array.Empty<object>()
                    : _context.Documents.Where(document => document.AchievementId == item.AchievementId)
                        .Select(document => new { document.DocumentId, document.DocumentName, document.FileUrl, document.Status })
                        .ToArray()
            })
            .ToListAsync();

        return Ok(new
        {
            athleteId = athlete.AthleteId,
            firstName = athlete.User.FirstName,
            lastName = athlete.User.LastName,
            studentNumber = athlete.StudentNumber,
            items
        });
    }

    [HttpPost]
    [Authorize(Roles = "ATHLETE,STUDENT")]
    public async Task<IActionResult> CreatePortfolioItem(PortfolioItemRequest request)
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

        if (request.AchievementId == null || !await AchievementBelongsToAthleteAsync(request.AchievementId, athlete.AthleteId))
        {
            return BadRequest(new { message = "A linked achievement belonging to this athlete is required." });
        }

        if (!await _context.Documents.AnyAsync(document =>
                document.AchievementId == request.AchievementId
                && document.AthleteId == athlete.AthleteId))
        {
            return BadRequest(new { message = "At least one evidence file is required before submitting this achievement." });
        }

        var item = new PortfolioItem
        {
            AthleteId = athlete.AthleteId,
            AchievementId = request.AchievementId,
            Title = request.Title.Trim(),
            Description = request.Description,
            DisplayOrder = request.DisplayOrder ?? 0,
            IsVisible = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.PortfolioItems.Add(item);
        await _context.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetMyPortfolio),
            null,
            ToResponse(item));
    }

    [HttpPut("{portfolioItemId}")]
    [Authorize(Roles = "ATHLETE,STUDENT")]
    public async Task<IActionResult> UpdatePortfolioItem(
        int portfolioItemId,
        PortfolioItemRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Title is required." });
        }

        var athlete = await GetCurrentAthleteAsync();
        var item = athlete == null
            ? null
            : await _context.PortfolioItems.FirstOrDefaultAsync(
                portfolioItem => portfolioItem.PortfolioItemId == portfolioItemId
                    && portfolioItem.AthleteId == athlete.AthleteId);

        if (item == null)
        {
            return NotFound(new { message = "Portfolio item not found." });
        }

        if (string.Equals(await GetAchievementStatusAsync(item.AchievementId), "VERIFIED", StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new { message = "Verified portfolio entries require staff approval before changes." });
        }

        if (request.AchievementId == null || !await AchievementBelongsToAthleteAsync(request.AchievementId, item.AthleteId))
        {
            return BadRequest(new { message = "A linked achievement belonging to this athlete is required." });
        }

        item.AchievementId = request.AchievementId;
        item.Title = request.Title.Trim();
        item.Description = request.Description;
        item.DisplayOrder = request.DisplayOrder ?? 0;
        item.IsVisible = true;

        await _context.SaveChangesAsync();

        return Ok(ToResponse(item));
    }

    [HttpDelete("{portfolioItemId}")]
    [Authorize(Roles = "ATHLETE,STUDENT")]
    public async Task<IActionResult> DeletePortfolioItem(int portfolioItemId)
    {
        var athlete = await GetCurrentAthleteAsync();
        var item = athlete == null
            ? null
            : await _context.PortfolioItems.FirstOrDefaultAsync(
                portfolioItem => portfolioItem.PortfolioItemId == portfolioItemId
                    && portfolioItem.AthleteId == athlete.AthleteId);

        if (item == null)
        {
            return NotFound(new { message = "Portfolio item not found." });
        }

        if (string.Equals(await GetAchievementStatusAsync(item.AchievementId), "VERIFIED", StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new { message = "Verified portfolio entries require staff approval before removal." });
        }

        _context.PortfolioItems.Remove(item);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPut("{portfolioItemId}/verify")]
    [Authorize(Roles = "COACH,DIRECTOR,ADMIN")]
    public async Task<IActionResult> VerifyPortfolioItem(
        int portfolioItemId,
        [FromBody] PortfolioVerificationRequest request)
    {
        var normalizedStatus = request.Status?.Trim().ToUpperInvariant() ?? "VERIFIED";

        if (normalizedStatus is not ("VERIFIED" or "REJECTED"))
        {
            return BadRequest(new { message = "Status must be VERIFIED or REJECTED." });
        }

        if (normalizedStatus == "REJECTED" && string.IsNullOrWhiteSpace(request.RejectionReason))
        {
            return BadRequest(new { message = "Rejection reason is required when rejecting a portfolio item." });
        }

        var item = await _context.PortfolioItems
            .Include(i => i.Achievement)
            .Include(i => i.Athlete).ThenInclude(athlete => athlete.User)
            .FirstOrDefaultAsync(i => i.PortfolioItemId == portfolioItemId);

        if (item == null)
        {
            return NotFound(new { message = "Portfolio item not found." });
        }

        if (!await CanAccessAthleteAsync(item.AthleteId))
        {
            return Forbid();
        }

        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return Unauthorized(new { message = "User ID was not found in the JWT." });
        }

        item.VerificationStatus = normalizedStatus;
        item.VerifiedBy = userId;
        item.VerifiedAt = DateTime.UtcNow;
        item.RejectionReason = normalizedStatus == "REJECTED" ? request.RejectionReason?.Trim() : null;

        if (item.Achievement != null)
        {
            item.Achievement.VerificationStatus = normalizedStatus;
            item.Achievement.VerifiedBy = userId;
            item.Achievement.VerifiedAt = DateTime.UtcNow;

            var evidenceDocuments = await _context.Documents
                .Where(document => document.AchievementId == item.AchievementId)
                .ToListAsync();

            if (normalizedStatus == "REJECTED")
            {
                foreach (var document in evidenceDocuments)
                {
                    document.Status = "REJECTED";
                }
            }
            else if (normalizedStatus == "VERIFIED")
            {
                foreach (var document in evidenceDocuments)
                {
                    document.Status = "APPROVED";
                }
            }
        }

        _context.Notifications.Add(new Notification
        {
            UserId = item.Athlete.UserId,
            Title = normalizedStatus == "VERIFIED" ? "Portfolio verified" : "Portfolio rejected",
            Message = normalizedStatus == "VERIFIED"
                ? $"Your portfolio submission \"{item.Title}\" was verified by your coach."
                : $"Your portfolio submission \"{item.Title}\" was rejected.{(string.IsNullOrWhiteSpace(item.RejectionReason) ? string.Empty : $" Reason: {item.RejectionReason}")}",
            NotificationType = normalizedStatus == "VERIFIED" ? "PORTFOLIO_VERIFIED" : "PORTFOLIO_REJECTED",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        return Ok(new
        {
            item.PortfolioItemId,
            achievementId = item.AchievementId,
            item.VerificationStatus,
            item.RejectionReason,
            item.IsVisible
        });
    }

    private async Task<AthleteProfile?> GetCurrentAthleteAsync()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return null;
        }

        return await _context.AthleteProfiles.FirstOrDefaultAsync(a => a.UserId == userId);
    }

    private Task<bool> AchievementBelongsToAthleteAsync(int? achievementId, int athleteId)
    {
        return achievementId == null
            ? Task.FromResult(true)
            : _context.Achievements.AnyAsync(
                achievement => achievement.AchievementId == achievementId
                    && achievement.AthleteId == athleteId);
    }

    private async Task<bool> CanAccessAthleteAsync(int athleteId)
    {
        if (User.IsInRole("DIRECTOR"))
        {
            return await _context.AthleteProfiles.AnyAsync(item => item.AthleteId == athleteId);
        }

        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return false;
        }

        var coach = await _context.CoachProfiles.FirstOrDefaultAsync(item => item.UserId == userId);
        return coach != null && await _context.TeamMembers.AnyAsync(member =>
            member.AthleteId == athleteId
            && member.DateLeft == null
            && member.Team.CoachId == coach.CoachId);
    }

    private Task<string?> GetAchievementStatusAsync(int? achievementId)
    {
        return achievementId == null
            ? Task.FromResult<string?>(null)
            : _context.Achievements
                .Where(achievement => achievement.AchievementId == achievementId)
                .Select(achievement => achievement.VerificationStatus)
                .FirstOrDefaultAsync();
    }

    private static PortfolioItemResponse ToResponse(PortfolioItem item)
    {
        return new PortfolioItemResponse
        {
            PortfolioItemId = item.PortfolioItemId,
            AchievementId = item.AchievementId,
            Title = item.Title,
            Description = item.Description,
            DisplayOrder = item.DisplayOrder,
            IsVisible = item.IsVisible,
            CreatedAt = item.CreatedAt
        };
    }
}