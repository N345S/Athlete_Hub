using AthleteHub.API.Data;
using AthleteHub.API.Models;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Services;

/// <summary>
/// Applies a staff verification decision to an achievement and everything tied to it:
/// its portfolio entries, its evidence documents, and the athlete's notification.
/// </summary>
public class AchievementReviewService
{
    private readonly AthleteHubDbContext _context;

    public AchievementReviewService(AthleteHubDbContext context) => _context = context;

    /// <summary>
    /// Normalizes a requested status, returning null when it is not VERIFIED or REJECTED.
    /// </summary>
    public static string? NormalizeStatus(string? status)
    {
        var normalized = string.IsNullOrWhiteSpace(status) ? "VERIFIED" : status.Trim().ToUpperInvariant();
        if (normalized == "APPROVED") normalized = "VERIFIED";
        return normalized is "VERIFIED" or "REJECTED" ? normalized : null;
    }

    /// <summary>
    /// Records the decision (caller saves). <paramref name="status"/> must already be normalized.
    /// </summary>
    public async Task ApplyAsync(Achievement achievement, string status, string? rejectionReason, int reviewerId, string reviewerRole)
    {
        var now = DateTime.UtcNow;
        var reason = status == "REJECTED" ? rejectionReason?.Trim() : null;

        achievement.VerificationStatus = status;
        achievement.VerifiedBy = reviewerId;
        achievement.VerifiedAt = now;
        achievement.RejectionReason = reason;

        var portfolioItems = await _context.PortfolioItems
            .Where(item => item.AchievementId == achievement.AchievementId)
            .ToListAsync();
        foreach (var item in portfolioItems)
        {
            item.VerificationStatus = status;
            item.VerifiedBy = reviewerId;
            item.VerifiedAt = now;
            item.RejectionReason = reason;
        }

        var evidenceDocuments = await _context.Documents
            .Where(document => document.AchievementId == achievement.AchievementId)
            .ToListAsync();
        foreach (var document in evidenceDocuments)
        {
            document.Status = status == "VERIFIED" ? "APPROVED" : "REJECTED";
        }

        var reviewer = reviewerRole switch
        {
            "DIRECTOR" => "the Sports Director",
            "ADMIN" => "an administrator",
            _ => "your coach"
        };

        _context.Notifications.Add(new Notification
        {
            UserId = achievement.Athlete.UserId,
            Title = status == "VERIFIED" ? "Portfolio verified" : "Portfolio rejected",
            Message = status == "VERIFIED"
                ? $"Your portfolio submission \"{achievement.Title}\" was verified by {reviewer}."
                : $"Your portfolio submission \"{achievement.Title}\" was rejected by {reviewer}.{(string.IsNullOrWhiteSpace(reason) ? string.Empty : $" Reason: {reason}")}",
            NotificationType = status == "VERIFIED" ? "PORTFOLIO_VERIFIED" : "PORTFOLIO_REJECTED",
            IsRead = false,
            CreatedAt = now
        });
    }
}
