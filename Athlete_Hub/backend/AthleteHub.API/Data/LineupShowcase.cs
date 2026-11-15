using System.Text.Json;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Data;

/// <summary>
/// Demo data for the Event lineups feature, added on top of the existing demo data without wiping anything:
/// four upcoming events with qualification rules, and lineups in every state.
/// <list type="bullet">
/// <item>Basketball semifinal: a lineup waiting for the Director.</item>
/// <item>Volleyball qualifier: an approved lineup with positions (its players were told they are in).</item>
/// <item>Track meet: a lineup the Director returned to the coach with a note.</item>
/// <item>Sports festival, open to every sport: a badminton lineup waiting, the other teams can still enter.</item>
/// </list>
/// Players are taken only from members who are Eligible today and meet each event's rules, so every lineup is
/// valid and the Director can approve the waiting ones. Dates are relative to today.
///
///   dotnet run -- --add-lineup-demo   (adds it now, unless upcoming showcase events are already there)
///
/// A demo database with no lineups at all also gets it automatically when the API starts.
/// </summary>
public class LineupShowcase
{
    private const string MedicalClearance = "Medical Clearance";

    private sealed record Plan(
        string Title, string Type, int Days, int StartHour, int EndHour, string Location, string Description,
        string? Sport, int Min, int Max, int? MaxAge, int? MaxYear, string[] Documents,
        string? LineupSport, string LineupStatus, string[] Positions, string? CoachNote, string? ReviewNote, int SubmittedDaysAgo);

    private static readonly Plan[] Plans =
    [
        new("Inter-Collegiate Basketball League — Semifinal", "COMPETITION", 6, 15, 18, "City Sports Arena",
            "Semifinal of the Inter-Collegiate Basketball League. Players must have a medical clearance on file.",
            "Basketball", 5, 12, null, null, [MedicalClearance],
            "Basketball", "PENDING", ["Point guard", "Shooting guard", "Small forward", "Power forward", "Center", "Reserve"],
            "Starting five first, then reserves.", null, 1),
        new("PRISAA Regional Volleyball Qualifier", "COMPETITION", 12, 8, 17, "Provincial Sports Complex",
            "Regional qualifier for the national PRISAA games. Open to first- to fourth-year students only.",
            "Volleyball", 6, 14, null, 4, [MedicalClearance],
            "Volleyball", "APPROVED", ["Setter", "Outside hitter", "Outside hitter", "Opposite hitter", "Middle blocker", "Middle blocker", "Libero"],
            "Same rotation as the friendly match.", "Approved. The bus leaves the main gate at 6:00 AM.", 4),
        new("City Invitational Track Meet", "COMPETITION", 18, 7, 16, "University Oval",
            "Invitational meet for university track and field teams. Athletes must be 23 or younger on the day.",
            "Track and Field", 3, 8, 23, null, [MedicalClearance],
            "Track and Field", "REJECTED", ["100m sprint", "Long jump", "4x100m relay", "4x100m relay"],
            null, "Please name a relay alternate as well, so the 4x100m team can still run if someone is injured.", 3),
        new("University Sports Festival", "SPORTS_EVENT", 24, 8, 17, "University Grounds",
            "Exhibition games and fun runs for every varsity team. Any sport may send a lineup.",
            null, 1, 10, null, null, [],
            "Badminton", "PENDING", ["Singles", "Singles", "Doubles", "Doubles"],
            "Two singles players and one doubles pair.", null, 0),
    ];

    private readonly AthleteHubDbContext _context;
    private readonly EligibilityService _eligibility;
    private readonly NotificationService _notifications;
    private readonly DateTime _today;

    public LineupShowcase(AthleteHubDbContext context, EligibilityService eligibility, NotificationService notifications, AppClock clock)
    {
        _context = context;
        _eligibility = eligibility;
        _notifications = notifications;
        _today = clock.LocalToday;
    }

    /// <summary>True when the database has no lineups at all, so the showcase can be added on start-up.</summary>
    public async Task<bool> HasNoLineupsAsync() => !await _context.EventLineups.AnyAsync();

    /// <summary>Adds the events and lineups, unless upcoming showcase events already exist. Returns what happened.</summary>
    public async Task<string> AddAsync()
    {
        var titles = Plans.Select(plan => plan.Title).ToList();
        if (await _context.Schedules.AnyAsync(item => titles.Contains(item.Title) && item.StartDatetime >= _today))
            return "The event lineup demo data is already there; nothing was added.";

        var director = await _context.Users.Where(user => user.Role.RoleName == "DIRECTOR" && user.AccountStatus == "ACTIVE")
            .OrderBy(user => user.UserId).FirstOrDefaultAsync();
        if (director == null) return "There is no active Sports Director account, so no event lineup demo data was added.";

        var sports = await _context.Sports.ToDictionaryAsync(sport => sport.SportName, sport => sport.SportId, StringComparer.OrdinalIgnoreCase);
        var teams = await _context.Teams
            .Include(team => team.Sport)
            .Include(team => team.Coach!).ThenInclude(coach => coach.User)
            .Include(team => team.TeamMembers).ThenInclude(member => member.Athlete).ThenInclude(athlete => athlete.User)
            .Where(team => team.Status == "ACTIVE")
            .ToListAsync();
        var memberIds = teams.SelectMany(team => team.TeamMembers.Where(member => member.DateLeft == null).Select(member => member.AthleteId)).Distinct().ToList();
        var eligibility = await _eligibility.EvaluateAsync(memberIds);
        var clearances = (await _context.Documents.Where(document => memberIds.Contains(document.AthleteId) && document.DocumentType == MedicalClearance)
            .Select(document => document.AthleteId).ToListAsync()).ToHashSet();
        var hasClearanceType = await _context.DocumentTypes.AnyAsync(type => type.Name == MedicalClearance);

        await using var transaction = await _context.Database.BeginTransactionAsync();
        var report = new List<string>();
        foreach (var plan in Plans)
        {
            var start = _today.AddDays(plan.Days);
            var documents = hasClearanceType ? plan.Documents : [];
            var item = new Schedule
            {
                Title = plan.Title,
                ScheduleType = plan.Type,
                StartDatetime = start.AddHours(plan.StartHour),
                EndDatetime = start.AddHours(plan.EndHour),
                Location = plan.Location,
                Description = plan.Description,
                CreatedBy = director.UserId,
                LineupSportId = plan.Sport != null && sports.TryGetValue(plan.Sport, out var sportId) ? sportId : null,
                LineupMinPlayers = plan.Min,
                LineupMaxPlayers = plan.Max,
                LineupMaxAge = plan.MaxAge,
                LineupMaxYearLevel = plan.MaxYear,
                LineupRequiredDocuments = documents.Length == 0 ? null : JsonSerializer.Serialize(documents)
            };
            _context.Schedules.Add(item);
            await _context.SaveChangesAsync();

            var team = teams.FirstOrDefault(candidate => string.Equals(candidate.Sport?.SportName, plan.LineupSport, StringComparison.OrdinalIgnoreCase));
            if (team == null)
            {
                report.Add($"{plan.Title}: event added, no {plan.LineupSport} team for a lineup.");
                continue;
            }

            // Only players who would pass the checks in LineupsController, so the lineup is valid.
            var qualified = team.TeamMembers
                .Where(member => member.DateLeft == null)
                .Select(member => member.Athlete)
                .Where(athlete => eligibility.GetValueOrDefault(athlete.AthleteId)?.Status == EligibilityService.Eligible)
                .Where(athlete => documents.Length == 0 || clearances.Contains(athlete.AthleteId))
                .Where(athlete => plan.MaxYear == null || athlete.YearLevel <= plan.MaxYear)
                .Where(athlete => plan.MaxAge == null || (athlete.BirthDate != null && AgeOn(athlete.BirthDate.Value, start) <= plan.MaxAge))
                .OrderByDescending(athlete => athlete.YearLevel).ThenBy(athlete => athlete.User.LastName)
                .Take(Math.Min(plan.Max, plan.Positions.Length))
                .ToList();
            if (qualified.Count == 0)
            {
                report.Add($"{plan.Title}: event added, but no {team.TeamName} member qualifies yet, so there is no lineup.");
                continue;
            }
            // With few eligible players the roster minimum follows what the team can field, so the lineup stays valid.
            if (qualified.Count < plan.Min) item.LineupMinPlayers = qualified.Count;

            var submittedAt = DateTime.UtcNow.AddDays(-plan.SubmittedDaysAgo).AddHours(-2);
            var lineup = new EventLineup
            {
                ScheduleId = item.ScheduleId,
                TeamId = team.TeamId,
                Status = plan.LineupStatus,
                Notes = plan.CoachNote,
                SubmittedBy = team.Coach?.UserId,
                SubmittedAt = submittedAt,
                ReviewedBy = plan.LineupStatus == "PENDING" ? null : director.UserId,
                ReviewedAt = plan.LineupStatus == "PENDING" ? null : submittedAt.AddDays(1),
                ReviewNote = plan.ReviewNote,
                Players = qualified.Select((athlete, index) => new EventLineupPlayer { AthleteId = athlete.AthleteId, Position = plan.Positions[index] }).ToList()
            };
            _context.EventLineups.Add(lineup);
            Notify(plan, item, team, lineup, director.UserId);
            await _context.SaveChangesAsync();
            report.Add($"{plan.Title} (in {plan.Days} days): {team.TeamName} lineup of {qualified.Count}, {plan.LineupStatus}.");
        }
        await transaction.CommitAsync();
        return "Added event lineup demo data:\n  " + string.Join("\n  ", report);
    }

    /// <summary>The messages the real flow would have sent, so the bells and dashboards match the lineups.</summary>
    private void Notify(Plan plan, Schedule item, Team team, EventLineup lineup, int directorUserId)
    {
        var when = item.StartDatetime.ToString("MMM d, yyyy");
        var count = lineup.Players.Count;
        if (plan.LineupStatus == "PENDING")
        {
            _notifications.Notify(directorUserId, "Lineup waiting for approval",
                $"{team.TeamName} sent a lineup of {count} player{(count == 1 ? "" : "s")} for {item.Title} on {when}.", "LINEUP_SUBMITTED");
            return;
        }
        if (team.Coach == null) return;
        if (plan.LineupStatus == "APPROVED")
        {
            _notifications.Notify(team.Coach.UserId, "Lineup approved",
                $"The Sports Director approved {team.TeamName}'s lineup for {item.Title} on {when}. Note: {plan.ReviewNote}", "LINEUP_APPROVED");
            _notifications.Notify(lineup.Players.Select(player => team.TeamMembers.First(member => member.AthleteId == player.AthleteId).Athlete.UserId),
                "You are in the lineup",
                $"You were selected for {team.TeamName} at {item.Title} on {when} at {item.Location}.", "LINEUP_APPROVED");
        }
        else
        {
            _notifications.Notify(team.Coach.UserId, "Lineup returned",
                $"The Sports Director returned {team.TeamName}'s lineup for {item.Title}: {plan.ReviewNote}", "LINEUP_REJECTED");
        }
    }

    private static int AgeOn(DateTime birthDate, DateTime date)
    {
        var age = date.Year - birthDate.Year;
        if (birthDate.Date > date.AddYears(-age)) age--;
        return age;
    }
}
