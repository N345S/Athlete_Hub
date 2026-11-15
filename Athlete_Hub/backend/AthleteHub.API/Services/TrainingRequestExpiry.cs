using AthleteHub.API.Data;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Services;

/// <summary>
/// A training request the Director never answered is useless once its date has passed (or, on the day itself, once
/// its start time has passed): approving it would publish a session that already happened. Such requests are marked
/// EXPIRED, which takes them out of the Director's approval queue, and the coach is told so they can request a new date.
/// Runs before anything that reads or reviews pending training, so the queue never shows a stale request.
/// </summary>
public class TrainingRequestExpiry
{
    public const string Expired = "EXPIRED";

    private readonly AthleteHubDbContext _context;
    private readonly NotificationService _notifications;
    private readonly AppClock _clock;

    public TrainingRequestExpiry(AthleteHubDbContext context, NotificationService notifications, AppClock clock)
    {
        _context = context;
        _notifications = notifications;
        _clock = clock;
    }

    /// <summary>Whether a request for this date and start time can no longer be approved.</summary>
    public bool HasPassed(DateTime trainingDate, TimeSpan? startTime)
    {
        var now = _clock.LocalNow;
        return trainingDate.Date < now.Date || (trainingDate.Date == now.Date && startTime.HasValue && startTime.Value <= now.TimeOfDay);
    }

    /// <summary>Marks every pending request whose time has passed as expired and notifies its coach. Returns how many expired.</summary>
    public async Task<int> ExpireStaleAsync()
    {
        var today = _clock.LocalToday;
        var candidates = await _context.TrainingSessions
            .Include(session => session.Team)
            .Include(session => session.Coach)
            .Where(session => session.ApprovalStatus == "PENDING" && session.TrainingDate <= today)
            .ToListAsync();
        var stale = candidates.Where(session => HasPassed(session.TrainingDate, session.StartTime)).ToList();
        if (stale.Count == 0) return 0;

        var now = DateTime.UtcNow;
        foreach (var session in stale)
        {
            session.ApprovalStatus = Expired;
            session.ReviewedAt = now;
            _notifications.Notify(session.Coach.UserId, "Training request expired",
                $"{session.Title} for {session.Team.TeamName} on {session.TrainingDate:MMM d, yyyy} was not approved before its date, so the request expired. Request a new date if the session is still needed.",
                "TRAINING_EXPIRED");
        }

        await _context.SaveChangesAsync();
        return stale.Count;
    }
}
