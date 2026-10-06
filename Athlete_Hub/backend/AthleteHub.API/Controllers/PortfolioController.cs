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
[Authorize]
public class PortfolioController : ControllerBase
{
    private readonly AthleteHubDbContext _context;
    private readonly AthleteAccessService _access;
    private readonly DocumentStorage _storage;
    private readonly AchievementReviewService _review;
    private readonly NotificationService _notifications;

    public PortfolioController(
        AthleteHubDbContext context,
        AthleteAccessService access,
        DocumentStorage storage,
        AchievementReviewService review,
        NotificationService notifications)
    {
        _notifications = notifications;
        _context = context;
        _access = access;
        _storage = storage;
        _review = review;
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

        return Ok(await GetPortfolioItemsAsync(athlete.AthleteId));
    }

    [HttpGet("athlete/{athleteId:int}")]
    [Authorize(Roles = "COACH,DIRECTOR")]
    public async Task<IActionResult> GetAthletePortfolio(int athleteId)
    {
        if (!await _access.CanViewAthleteAsync(User, athleteId, includeRegistrar: false))
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

        return Ok(new
        {
            athleteId = athlete.AthleteId,
            firstName = athlete.User.FirstName,
            lastName = athlete.User.LastName,
            studentNumber = athlete.StudentNumber,
            course = athlete.Course,
            yearLevel = athlete.YearLevel,
            items = await GetPortfolioItemsAsync(athleteId)
        });
    }

    /// <summary>
    /// Submits an achievement with its evidence files as one portfolio entry, all or nothing.
    /// </summary>
    /// <response code="201">The achievement, evidence, and portfolio entry were created.</response>
    /// <response code="400">Missing title, invalid date/category, or invalid evidence files.</response>
    [HttpPost("submit")]
    [Authorize(Roles = "ATHLETE,STUDENT")]
    [RequestSizeLimit(60_000_000)]
    public async Task<IActionResult> SubmitAchievement(
        [FromForm] string title,
        [FromForm] string? description,
        [FromForm] DateTime? achievementDate,
        [FromForm] string? category)
    {
        if (string.IsNullOrWhiteSpace(title) || title.Trim().Length > 200)
        {
            return BadRequest(new { message = "A title of up to 200 characters is required." });
        }
        if (category?.Trim().Length > 100)
        {
            return BadRequest(new { message = "Category must be 100 characters or fewer." });
        }
        if (achievementDate.HasValue && achievementDate.Value.Date > DateTime.UtcNow.Date.AddDays(1))
        {
            return BadRequest(new { message = "The achievement date cannot be in the future." });
        }

        var files = DocumentsController.GetUploadedFiles(Request.Form.Files);
        var fileError = DocumentsController.ValidateFiles(files);
        if (fileError != null)
        {
            return BadRequest(new { message = fileError });
        }

        var athlete = await GetCurrentAthleteAsync();
        if (athlete == null)
        {
            return NotFound(new { message = "Athlete profile not found." });
        }

        var savedDocuments = new List<Document>();
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var achievement = new Achievement
            {
                AthleteId = athlete.AthleteId,
                Title = title.Trim(),
                Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
                AchievementDate = achievementDate?.Date,
                Category = string.IsNullOrWhiteSpace(category) ? null : category.Trim(),
                VerificationStatus = "PENDING",
                CreatedAt = DateTime.UtcNow
            };
            _context.Achievements.Add(achievement);
            await _context.SaveChangesAsync();

            savedDocuments = await _storage.CreateDocumentsAsync(
                files, athlete.AthleteId, "Achievement Evidence", achievement.Title, null, achievement.AchievementId);
            _context.Documents.AddRange(savedDocuments);

            var item = new PortfolioItem
            {
                AthleteId = athlete.AthleteId,
                AchievementId = achievement.AchievementId,
                Title = achievement.Title,
                Description = achievement.Description,
                DisplayOrder = 0,
                IsVisible = true,
                VerificationStatus = "PENDING",
                CreatedAt = DateTime.UtcNow
            };
            _context.PortfolioItems.Add(item);
            _notifications.Notify(
                await _notifications.CoachUserIdsForAthleteAsync(athlete.AthleteId),
                "New portfolio submission",
                $"{await AthleteNameAsync(athlete.AthleteId)} submitted \"{achievement.Title}\" for verification.",
                "PORTFOLIO_SUBMITTED");
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return CreatedAtAction(nameof(GetMyPortfolio), null, ToResponse(item));
        }
        catch
        {
            // Nothing was committed, so remove any files already written for this submission.
            foreach (var document in savedDocuments) _storage.Delete(document.FileUrl);
            throw;
        }
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

        if (request.AchievementId == null || !await AchievementBelongsToAthleteAsync(request.AchievementId.Value, athlete.AthleteId))
        {
            return BadRequest(new { message = "A linked achievement belonging to this athlete is required." });
        }

        if (await _context.PortfolioItems.AnyAsync(item => item.AchievementId == request.AchievementId))
        {
            return Conflict(new { message = "This achievement is already in your portfolio." });
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
            VerificationStatus = "PENDING",
            CreatedAt = DateTime.UtcNow
        };

        _context.PortfolioItems.Add(item);
        await _context.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetMyPortfolio),
            null,
            ToResponse(item));
    }

    [HttpPut("{portfolioItemId:int}")]
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

        if (request.AchievementId == null || !await AchievementBelongsToAthleteAsync(request.AchievementId.Value, item.AthleteId))
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

    /// <summary>
    /// Removes an unverified portfolio entry together with its achievement and evidence files.
    /// </summary>
    [HttpDelete("{portfolioItemId:int}")]
    [Authorize(Roles = "ATHLETE,STUDENT")]
    public async Task<IActionResult> DeletePortfolioItem(int portfolioItemId)
    {
        var athlete = await GetCurrentAthleteAsync();
        var item = athlete == null
            ? null
            : await _context.PortfolioItems
                .Include(portfolioItem => portfolioItem.Achievement)
                .FirstOrDefaultAsync(portfolioItem => portfolioItem.PortfolioItemId == portfolioItemId
                    && portfolioItem.AthleteId == athlete.AthleteId);

        if (item == null)
        {
            return NotFound(new { message = "Portfolio item not found." });
        }

        if (string.Equals(item.Achievement?.VerificationStatus, "VERIFIED", StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new { message = "Verified portfolio entries require staff approval before removal." });
        }

        var evidence = item.AchievementId == null
            ? []
            : await _context.Documents.Where(document => document.AchievementId == item.AchievementId).ToListAsync();

        _context.Documents.RemoveRange(evidence);
        _context.PortfolioItems.Remove(item);
        if (item.Achievement != null)
        {
            var otherEntries = await _context.PortfolioItems.AnyAsync(other =>
                other.AchievementId == item.AchievementId && other.PortfolioItemId != item.PortfolioItemId);
            if (!otherEntries) _context.Achievements.Remove(item.Achievement);
        }

        await _context.SaveChangesAsync();
        foreach (var document in evidence) _storage.Delete(document.FileUrl);

        return NoContent();
    }

    // Verifying achievements is the coach's job; the director only monitors.
    [HttpPut("{portfolioItemId:int}/verify")]
    [Authorize(Roles = "COACH")]
    public async Task<IActionResult> VerifyPortfolioItem(
        int portfolioItemId,
        [FromBody] PortfolioVerificationRequest request)
    {
        var normalizedStatus = AchievementReviewService.NormalizeStatus(request.Status);

        if (normalizedStatus == null)
        {
            return BadRequest(new { message = "Status must be VERIFIED or REJECTED." });
        }

        if (normalizedStatus == "REJECTED" && string.IsNullOrWhiteSpace(request.RejectionReason))
        {
            return BadRequest(new { message = "Rejection reason is required when rejecting a portfolio item." });
        }

        var item = await _context.PortfolioItems
            .Include(i => i.Achievement).ThenInclude(achievement => achievement!.Athlete)
            .Include(i => i.Athlete)
            .FirstOrDefaultAsync(i => i.PortfolioItemId == portfolioItemId);

        if (item == null)
        {
            return NotFound(new { message = "Portfolio item not found." });
        }

        if (!await _access.CanViewAthleteAsync(User, item.AthleteId, includeRegistrar: false))
        {
            return Forbid();
        }

        var userId = AthleteAccessService.GetUserId(User);
        if (userId == null)
        {
            return Unauthorized(new { message = "User ID was not found in the JWT." });
        }

        if (item.Achievement != null)
        {
            await _review.ApplyAsync(item.Achievement, normalizedStatus, request.RejectionReason, userId.Value, User.FindFirstValue(ClaimTypes.Role) ?? "");
        }
        else
        {
            item.VerificationStatus = normalizedStatus;
            item.VerifiedBy = userId;
            item.VerifiedAt = DateTime.UtcNow;
            item.RejectionReason = normalizedStatus == "REJECTED" ? request.RejectionReason?.Trim() : null;
        }

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

    private async Task<List<object>> GetPortfolioItemsAsync(int athleteId)
    {
        var items = await _context.PortfolioItems
            .AsNoTracking()
            .Where(item => item.AthleteId == athleteId)
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
                RejectionReason = item.Achievement != null && item.Achievement.RejectionReason != null
                    ? item.Achievement.RejectionReason
                    : item.RejectionReason,
                item.VerifiedAt,
                AchievementDate = item.Achievement == null ? null : item.Achievement.AchievementDate,
                Category = item.Achievement == null ? null : item.Achievement.Category,
                AchievementStatus = item.Achievement == null ? null : item.Achievement.VerificationStatus,
                Evidence = _context.Documents
                    .Where(document => item.AchievementId != null && document.AchievementId == item.AchievementId)
                    .Select(document => new { document.DocumentId, document.DocumentName, document.Status })
                    .ToList()
            })
            .ToListAsync();

        return items.Select(item => (object)new
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
            achievementDate = item.AchievementDate?.ToString("yyyy-MM-dd"),
            item.Category,
            item.AchievementStatus,
            evidence = item.Evidence.Select(document => new
            {
                document.DocumentId,
                document.DocumentName,
                fileUrl = DocumentStorage.DownloadUrl(document.DocumentId),
                document.Status
            })
        }).ToList();
    }

    private Task<string> AthleteNameAsync(int athleteId) => _context.AthleteProfiles
        .Where(athlete => athlete.AthleteId == athleteId)
        .Select(athlete => athlete.User.FirstName + " " + athlete.User.LastName)
        .FirstAsync();

    private async Task<AthleteProfile?> GetCurrentAthleteAsync()
    {
        var userId = AthleteAccessService.GetUserId(User);
        return userId == null ? null : await _context.AthleteProfiles.FirstOrDefaultAsync(a => a.UserId == userId);
    }

    private Task<bool> AchievementBelongsToAthleteAsync(int achievementId, int athleteId) =>
        _context.Achievements.AnyAsync(achievement => achievement.AchievementId == achievementId && achievement.AthleteId == athleteId);

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
