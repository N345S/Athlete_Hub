using AthleteHub.API.Data;
using AthleteHub.API.Models;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Services;

/// <summary>
/// Queues in-app notifications (the caller saves) and resolves common recipient groups.
/// </summary>
public class NotificationService
{
    private readonly AthleteHubDbContext _context;

    public NotificationService(AthleteHubDbContext context) => _context = context;

    public void Notify(IEnumerable<int> userIds, string title, string message, string type)
    {
        var now = DateTime.UtcNow;
        _context.Notifications.AddRange(userIds.Distinct().Select(userId => new Notification
        {
            UserId = userId,
            Title = title,
            Message = message,
            NotificationType = type,
            IsRead = false,
            CreatedAt = now
        }));
    }

    public void Notify(int userId, string title, string message, string type) => Notify([userId], title, message, type);

    /// <summary>Active accounts with the given role.</summary>
    public Task<List<int>> ActiveUserIdsInRoleAsync(string roleName) => _context.Users
        .Where(user => user.Role.RoleName == roleName && user.AccountStatus == "ACTIVE")
        .Select(user => user.UserId)
        .ToListAsync();

    /// <summary>Active coaches of the teams the athlete currently belongs to.</summary>
    public Task<List<int>> CoachUserIdsForAthleteAsync(int athleteId) => _context.TeamMembers
        .Where(member => member.AthleteId == athleteId && member.DateLeft == null && member.Team.Coach != null && member.Team.Coach.User.AccountStatus == "ACTIVE")
        .Select(member => member.Team.Coach!.UserId)
        .Distinct()
        .ToListAsync();

    /// <summary>Active parent accounts linked to the athlete, with the child's first name for the message.</summary>
    public async Task<List<(int ParentUserId, string ChildName)>> ParentsOfAthletesAsync(IEnumerable<int> athleteIds)
    {
        var ids = athleteIds.Distinct().ToList();
        var rows = await _context.ParentAthletes
            .Where(link => ids.Contains(link.AthleteId) && link.ParentUser.AccountStatus == "ACTIVE" && link.ParentUser.Role.RoleName == "PARENT")
            .Select(link => new { link.ParentUserId, link.Athlete.User.FirstName })
            .ToListAsync();
        return rows.Select(row => (row.ParentUserId, row.FirstName)).ToList();
    }
}
