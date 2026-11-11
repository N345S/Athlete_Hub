using System.Text.Json;
using AthleteHub.API.Data;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

/// <summary>
/// Event lineups. The Sports Director sets each event's qualification rules (sport, roster size, required
/// documents, league age and year-level limits). A coach picks players for one of their teams, only from
/// members who are Eligible (see <see cref="EligibilityService"/>), and the rules are checked before the lineup
/// is sent. The Director then approves or returns it; the coach is notified, and on approval so are the players.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "COACH,DIRECTOR")]
public class LineupsController : ControllerBase
{
    private static readonly string[] EventTypes = ["COMPETITION", "SPORTS_EVENT"];

    private readonly AthleteHubDbContext _context;
    private readonly EligibilityService _eligibility;
    private readonly NotificationService _notifications;
    private readonly AppClock _clock;

    public LineupsController(AthleteHubDbContext context, EligibilityService eligibility, NotificationService notifications, AppClock clock)
    {
        _context = context;
        _eligibility = eligibility;
        _notifications = notifications;
        _clock = clock;
    }

    /// <summary>
    /// Upcoming sports events and competitions with their rules and lineups. Coaches see their own teams'
    /// lineups and which of their teams may enter; the Director sees every lineup.
    /// </summary>
    [HttpGet("events")]
    public async Task<IActionResult> GetEvents(bool includePast = false)
    {
        var today = _clock.LocalToday;
        var coach = await CurrentCoachAsync();
        if (User.IsInRole("COACH") && coach == null) return Ok(new { events = Array.Empty<object>(), teams = Array.Empty<object>(), sports = Array.Empty<object>() });

        var events = await _context.Schedules.AsNoTracking()
            .Include(item => item.LineupSport)
            .Where(item => EventTypes.Contains(item.ScheduleType) && (includePast || item.StartDatetime >= today))
            .OrderBy(item => item.StartDatetime)
            .ToListAsync();
        var eventIds = events.Select(item => item.ScheduleId).ToList();

        var lineupsQuery = _context.EventLineups.AsNoTracking()
            .Include(lineup => lineup.Team).ThenInclude(team => team.Sport)
            .Include(lineup => lineup.Team).ThenInclude(team => team.Coach!).ThenInclude(item => item.User)
            .Include(lineup => lineup.Players)
            .Where(lineup => eventIds.Contains(lineup.ScheduleId));
        if (coach != null) lineupsQuery = lineupsQuery.Where(lineup => lineup.Team.CoachId == coach.CoachId);
        var lineups = await lineupsQuery.ToListAsync();

        var coachId = coach?.CoachId ?? 0;
        var teams = await _context.Teams.AsNoTracking()
            .Where(team => coach != null && team.CoachId == coachId && team.Status == "ACTIVE")
            .Select(team => new { team.TeamId, team.TeamName, team.SportId, sport = team.Sport.SportName, members = team.TeamMembers.Count(member => member.DateLeft == null) })
            .ToListAsync();
        var sports = await _context.Sports.AsNoTracking().OrderBy(sport => sport.SportName).Select(sport => new { sport.SportId, sport.SportName }).ToListAsync();

        return Ok(new
        {
            events = events.Select(item => new
            {
                scheduleId = item.ScheduleId,
                item.Title,
                type = item.ScheduleType,
                startDate = item.StartDatetime.ToString("yyyy-MM-dd"),
                startTime = item.StartDatetime.ToString("HH:mm:ss"),
                item.Location,
                cancelled = item.CancelledAt != null,
                past = item.StartDatetime.Date < today,
                rules = DescribeRules(item),
                // Teams a coach could still enter: matching sport, not entered yet.
                openTeams = teams
                    .Where(team => item.LineupSportId == null || team.SportId == item.LineupSportId)
                    .Where(team => !lineups.Any(lineup => lineup.ScheduleId == item.ScheduleId && lineup.TeamId == team.TeamId))
                    .Select(team => team.TeamId),
                lineups = lineups.Where(lineup => lineup.ScheduleId == item.ScheduleId).OrderBy(lineup => lineup.Team.TeamName).Select(Summary)
            }),
            teams,
            sports,
            pendingCount = lineups.Count(lineup => lineup.Status == "PENDING")
        });
    }

    /// <summary>The Director's qualification rules for one event.</summary>
    [HttpPut("events/{scheduleId:int}/rules")]
    [Authorize(Roles = "DIRECTOR")]
    public async Task<IActionResult> SetRules(int scheduleId, LineupRulesRequest request)
    {
        var item = await _context.Schedules.FirstOrDefaultAsync(schedule => schedule.ScheduleId == scheduleId && EventTypes.Contains(schedule.ScheduleType));
        if (item == null) return NotFound(new { message = "We could not find this event." });
        if (request.MinPlayers is < 1 or > 100 || request.MaxPlayers is < 1 or > 100)
            return BadRequest(new { message = "Roster size must be between 1 and 100 players." });
        if (request.MinPlayers.HasValue && request.MaxPlayers.HasValue && request.MinPlayers > request.MaxPlayers)
            return BadRequest(new { message = "The minimum roster size cannot be larger than the maximum." });
        if (request.MaxAge is < 10 or > 60) return BadRequest(new { message = "The age limit must be between 10 and 60." });
        if (request.MaxYearLevel is < 1 or > 6) return BadRequest(new { message = "The year level limit must be between 1 and 6." });
        if (request.SportId.HasValue && !await _context.Sports.AnyAsync(sport => sport.SportId == request.SportId))
            return BadRequest(new { message = "Please choose a sport from the list." });

        var documents = (request.RequiredDocuments ?? [])
            .Select(DocumentTypesController.Clean)
            .Where(name => name.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var known = await _context.DocumentTypes.Where(type => documents.Contains(type.Name)).Select(type => type.Name).ToListAsync();
        if (documents.Count != known.Count) return BadRequest(new { message = "Some required documents are not on the document type list." });

        item.LineupSportId = request.SportId;
        item.LineupMinPlayers = request.MinPlayers;
        item.LineupMaxPlayers = request.MaxPlayers;
        item.LineupMaxAge = request.MaxAge;
        item.LineupMaxYearLevel = request.MaxYearLevel;
        item.LineupRequiredDocuments = documents.Count == 0 ? null : JsonSerializer.Serialize(documents);
        await _context.SaveChangesAsync();
        await _context.Entry(item).Reference(schedule => schedule.LineupSport).LoadAsync();
        return Ok(DescribeRules(item));
    }

    /// <summary>
    /// A coach's team members for an event, each with their eligibility and whether they meet the event's rules,
    /// so only qualified players can be picked.
    /// </summary>
    [HttpGet("events/{scheduleId:int}/candidates")]
    public async Task<IActionResult> GetCandidates(int scheduleId, int teamId)
    {
        var item = await _context.Schedules.AsNoTracking().Include(schedule => schedule.LineupSport)
            .FirstOrDefaultAsync(schedule => schedule.ScheduleId == scheduleId && EventTypes.Contains(schedule.ScheduleType));
        if (item == null) return NotFound(new { message = "We could not find this event." });
        var team = await FindTeamAsync(teamId);
        if (team == null) return NotFound(new { message = "We could not find this team." });
        if (!await CanManageTeamAsync(team)) return Forbid();

        var memberIds = team.TeamMembers.Where(member => member.DateLeft == null).Select(member => member.AthleteId).ToList();
        var checks = await CheckPlayersAsync(item, memberIds);
        return Ok(new
        {
            rules = DescribeRules(item),
            teamProblem = TeamProblem(item, team),
            players = team.TeamMembers.Where(member => member.DateLeft == null)
                .OrderBy(member => member.Athlete.User.LastName).ThenBy(member => member.Athlete.User.FirstName)
                .Select(member => new
                {
                    member.AthleteId,
                    member.Athlete.User.FirstName,
                    member.Athlete.User.LastName,
                    member.Athlete.StudentNumber,
                    member.Athlete.Course,
                    member.Athlete.YearLevel,
                    eligibility = EligibilityService.Describe(checks.Eligibility.GetValueOrDefault(member.AthleteId)),
                    problems = checks.Problems[member.AthleteId],
                    qualified = checks.Problems[member.AthleteId].Count == 0
                })
        });
    }

    [HttpGet("{lineupId:int}")]
    public async Task<IActionResult> Get(int lineupId)
    {
        var lineup = await LoadLineupAsync(lineupId);
        if (lineup == null) return NotFound(new { message = "We could not find this lineup." });
        if (!await CanManageTeamAsync(lineup.Team)) return Forbid();
        var checks = await CheckPlayersAsync(lineup.Schedule, lineup.Players.Select(player => player.AthleteId).ToList());
        return Ok(Detail(lineup, checks));
    }

    /// <summary>Sends (or resends) a team's lineup for an event to the Director. Every rule is checked first.</summary>
    [HttpPost]
    [Authorize(Roles = "COACH")]
    public async Task<IActionResult> Submit(LineupRequest request)
    {
        var item = await _context.Schedules.Include(schedule => schedule.LineupSport)
            .FirstOrDefaultAsync(schedule => schedule.ScheduleId == request.ScheduleId && EventTypes.Contains(schedule.ScheduleType));
        if (item == null) return NotFound(new { message = "We could not find this event." });
        if (item.CancelledAt != null) return BadRequest(new { message = "This event was cancelled." });
        if (item.StartDatetime.Date < _clock.LocalToday) return BadRequest(new { message = "This event has already taken place." });

        var team = await FindTeamAsync(request.TeamId);
        if (team == null) return NotFound(new { message = "We could not find this team." });
        if (!await CanManageTeamAsync(team)) return Forbid();
        var teamProblem = TeamProblem(item, team);
        if (teamProblem != null) return BadRequest(new { message = teamProblem });

        var picks = (request.Players ?? [])
            .GroupBy(player => player.AthleteId)
            .Select(group => group.First())
            .ToList();
        if (picks.Count == 0) return BadRequest(new { message = "Please choose at least one player." });
        if (picks.Any(player => (player.Position?.Trim().Length ?? 0) > 50)) return BadRequest(new { message = "Positions must be 50 characters or fewer." });
        var memberIds = team.TeamMembers.Where(member => member.DateLeft == null).Select(member => member.AthleteId).ToHashSet();
        if (picks.Any(player => !memberIds.Contains(player.AthleteId)))
            return BadRequest(new { message = "Players can only be chosen from this team's current members." });

        var checks = await CheckPlayersAsync(item, picks.Select(player => player.AthleteId).ToList());
        var problems = RosterProblems(item, picks.Count);
        var names = team.TeamMembers.ToDictionary(member => member.AthleteId, member => $"{member.Athlete.User.FirstName} {member.Athlete.User.LastName}");
        problems.AddRange(picks.Where(player => checks.Problems[player.AthleteId].Count > 0)
            .Select(player => $"{names[player.AthleteId]}: {string.Join("; ", checks.Problems[player.AthleteId])}"));
        if (problems.Count > 0) return BadRequest(new { message = "This lineup does not meet the event's rules.", problems });

        await using var transaction = await _context.Database.BeginTransactionAsync();
        var lineup = await _context.EventLineups.Include(existing => existing.Players)
            .FirstOrDefaultAsync(existing => existing.ScheduleId == item.ScheduleId && existing.TeamId == team.TeamId);
        var resubmitted = lineup != null;
        if (lineup == null)
        {
            lineup = new EventLineup { ScheduleId = item.ScheduleId, TeamId = team.TeamId };
            _context.EventLineups.Add(lineup);
        }
        else
        {
            // Removed first, so a player picked again does not clash with their old row.
            _context.EventLineupPlayers.RemoveRange(lineup.Players);
            await _context.SaveChangesAsync();
        }
        lineup.Status = "PENDING";
        lineup.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        lineup.SubmittedBy = AthleteAccessService.GetUserId(User);
        lineup.SubmittedAt = DateTime.UtcNow;
        lineup.ReviewedBy = null;
        lineup.ReviewedAt = null;
        lineup.ReviewNote = null;
        lineup.Players = picks.Select(player => new EventLineupPlayer
        {
            AthleteId = player.AthleteId,
            Position = string.IsNullOrWhiteSpace(player.Position) ? null : player.Position.Trim()
        }).ToList();

        _notifications.Notify(await _notifications.ActiveUserIdsInRoleAsync("DIRECTOR"),
            resubmitted ? "Lineup resubmitted" : "Lineup waiting for approval",
            $"{team.TeamName} sent a lineup of {picks.Count} player{(picks.Count == 1 ? "" : "s")} for {item.Title} on {item.StartDatetime:MMM d, yyyy}.",
            "LINEUP_SUBMITTED");
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { lineupId = lineup.LineupId, status = lineup.Status, resubmitted });
    }

    /// <summary>The coach withdraws their team from the event.</summary>
    [HttpDelete("{lineupId:int}")]
    [Authorize(Roles = "COACH")]
    public async Task<IActionResult> Withdraw(int lineupId)
    {
        var lineup = await LoadLineupAsync(lineupId, tracking: true);
        if (lineup == null) return NotFound(new { message = "We could not find this lineup." });
        if (!await CanManageTeamAsync(lineup.Team)) return Forbid();
        if (lineup.Schedule.StartDatetime.Date < _clock.LocalToday) return BadRequest(new { message = "This event has already taken place." });

        if (lineup.Status == "APPROVED")
        {
            _notifications.Notify(await _notifications.ActiveUserIdsInRoleAsync("DIRECTOR"), "Lineup withdrawn",
                $"{lineup.Team.TeamName} withdrew its approved lineup for {lineup.Schedule.Title}.", "LINEUP_WITHDRAWN");
        }
        _context.EventLineups.Remove(lineup);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>The Director approves a lineup (the rules are checked again) or returns it to the coach with a note.</summary>
    [HttpPost("{lineupId:int}/review")]
    [Authorize(Roles = "DIRECTOR")]
    public async Task<IActionResult> Review(int lineupId, LineupReviewRequest request)
    {
        var lineup = await LoadLineupAsync(lineupId, tracking: true);
        if (lineup == null) return NotFound(new { message = "We could not find this lineup." });
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (!request.Approve && note == null) return BadRequest(new { message = "Please tell the coach what to change." });

        var checks = await CheckPlayersAsync(lineup.Schedule, lineup.Players.Select(player => player.AthleteId).ToList());
        if (request.Approve)
        {
            // Eligibility can change after the coach sends the lineup (new grades, a removed clearance).
            var problems = RosterProblems(lineup.Schedule, lineup.Players.Count);
            var teamProblem = TeamProblem(lineup.Schedule, lineup.Team);
            if (teamProblem != null) problems.Add(teamProblem);
            problems.AddRange(lineup.Players.Where(player => checks.Problems[player.AthleteId].Count > 0)
                .Select(player => $"{player.Athlete.User.FirstName} {player.Athlete.User.LastName}: {string.Join("; ", checks.Problems[player.AthleteId])}"));
            if (problems.Count > 0) return BadRequest(new { message = "This lineup no longer meets the event's rules. Return it to the coach instead.", problems });
        }

        lineup.Status = request.Approve ? "APPROVED" : "REJECTED";
        lineup.ReviewNote = note;
        lineup.ReviewedBy = AthleteAccessService.GetUserId(User);
        lineup.ReviewedAt = DateTime.UtcNow;

        var when = lineup.Schedule.StartDatetime.ToString("MMM d, yyyy");
        if (lineup.Team.Coach != null)
        {
            _notifications.Notify(lineup.Team.Coach.UserId,
                request.Approve ? "Lineup approved" : "Lineup returned",
                request.Approve
                    ? $"The Sports Director approved {lineup.Team.TeamName}'s lineup for {lineup.Schedule.Title} on {when}.{(note == null ? "" : $" Note: {note}")}"
                    : $"The Sports Director returned {lineup.Team.TeamName}'s lineup for {lineup.Schedule.Title}: {note}",
                request.Approve ? "LINEUP_APPROVED" : "LINEUP_REJECTED");
        }
        if (request.Approve)
        {
            _notifications.Notify(lineup.Players.Select(player => player.Athlete.UserId),
                "You are in the lineup",
                $"You were selected for {lineup.Team.TeamName} at {lineup.Schedule.Title} on {when}{(lineup.Schedule.Location == null ? "" : $" at {lineup.Schedule.Location}")}.",
                "LINEUP_APPROVED");
        }
        await _context.SaveChangesAsync();
        return Ok(Detail(lineup, checks));
    }

    private sealed record PlayerChecks(Dictionary<int, EligibilityService.Result> Eligibility, Dictionary<int, List<string>> Problems);

    /// <summary>Each player's problems against the event: not Eligible, missing a required document, over an age or year limit.</summary>
    private async Task<PlayerChecks> CheckPlayersAsync(Schedule item, List<int> athleteIds)
    {
        var eligibility = await _eligibility.RefreshAsync(athleteIds);
        var required = RequiredDocuments(item);
        var documents = (await _context.Documents.AsNoTracking()
                .Where(document => athleteIds.Contains(document.AthleteId) && required.Contains(document.DocumentType))
                .Select(document => new { document.AthleteId, document.DocumentType })
                .ToListAsync())
            .GroupBy(document => document.AthleteId)
            .ToDictionary(group => group.Key, group => group.Select(document => document.DocumentType).ToHashSet(StringComparer.OrdinalIgnoreCase));
        var profiles = await _context.AthleteProfiles.AsNoTracking()
            .Where(athlete => athleteIds.Contains(athlete.AthleteId))
            .ToDictionaryAsync(athlete => athlete.AthleteId, athlete => new { athlete.BirthDate, athlete.YearLevel });

        var problems = new Dictionary<int, List<string>>();
        foreach (var athleteId in athleteIds)
        {
            var list = new List<string>();
            var status = eligibility.GetValueOrDefault(athleteId);
            if (status?.Status != EligibilityService.Eligible)
                list.Add(status?.Status == EligibilityService.Restricted ? $"Restricted ({string.Join("; ", status.Reasons)})" : "Eligibility under review");

            // A document already missing from the eligibility reasons is not listed twice.
            var onFile = documents.GetValueOrDefault(athleteId) ?? [];
            list.AddRange(required.Where(type => !onFile.Contains(type))
                .Select(type => $"{type} not on file")
                .Where(problem => status?.Reasons.Contains(problem) != true));

            var profile = profiles.GetValueOrDefault(athleteId);
            if (item.LineupMaxAge.HasValue)
            {
                if (profile?.BirthDate == null) list.Add("Birth date missing (needed for the age limit)");
                else
                {
                    var age = AgeOn(profile.BirthDate.Value, item.StartDatetime.Date);
                    if (age > item.LineupMaxAge) list.Add($"Age {age} is over the limit of {item.LineupMaxAge}");
                }
            }
            if (item.LineupMaxYearLevel.HasValue && profile?.YearLevel > item.LineupMaxYearLevel)
                list.Add($"Year {profile.YearLevel} is above the year {item.LineupMaxYearLevel} limit");
            problems[athleteId] = list;
        }
        return new PlayerChecks(eligibility, problems);
    }

    private static List<string> RosterProblems(Schedule item, int count)
    {
        var problems = new List<string>();
        if (item.LineupMinPlayers.HasValue && count < item.LineupMinPlayers)
            problems.Add($"At least {item.LineupMinPlayers} players are required; {count} chosen.");
        if (item.LineupMaxPlayers.HasValue && count > item.LineupMaxPlayers)
            problems.Add($"At most {item.LineupMaxPlayers} players are allowed; {count} chosen.");
        return problems;
    }

    private static string? TeamProblem(Schedule item, Team team) =>
        item.LineupSportId.HasValue && team.SportId != item.LineupSportId
            ? $"This event is for {item.LineupSport?.SportName ?? "another sport"} teams only."
            : null;

    private static List<string> RequiredDocuments(Schedule item)
    {
        if (string.IsNullOrWhiteSpace(item.LineupRequiredDocuments)) return [];
        try { return JsonSerializer.Deserialize<List<string>>(item.LineupRequiredDocuments) ?? []; }
        catch (JsonException) { return []; }
    }

    private static int AgeOn(DateTime birthDate, DateTime date)
    {
        var age = date.Year - birthDate.Year;
        if (birthDate.Date > date.AddYears(-age)) age--;
        return age;
    }

    private static object DescribeRules(Schedule item) => new
    {
        sportId = item.LineupSportId,
        sport = item.LineupSport?.SportName,
        minPlayers = item.LineupMinPlayers,
        maxPlayers = item.LineupMaxPlayers,
        requiredDocuments = RequiredDocuments(item),
        maxAge = item.LineupMaxAge,
        maxYearLevel = item.LineupMaxYearLevel
    };

    private static object Summary(EventLineup lineup) => new
    {
        lineup.LineupId,
        lineup.ScheduleId,
        lineup.TeamId,
        teamName = lineup.Team.TeamName,
        sport = lineup.Team.Sport?.SportName,
        coachName = lineup.Team.Coach == null ? null : $"{lineup.Team.Coach.User.FirstName} {lineup.Team.Coach.User.LastName}",
        lineup.Status,
        players = lineup.Players.Count,
        lineup.SubmittedAt,
        lineup.ReviewedAt,
        lineup.ReviewNote
    };

    private static object Detail(EventLineup lineup, PlayerChecks checks) => new
    {
        lineup.LineupId,
        lineup.ScheduleId,
        lineup.TeamId,
        teamName = lineup.Team.TeamName,
        sport = lineup.Team.Sport?.SportName,
        coachName = lineup.Team.Coach == null ? null : $"{lineup.Team.Coach.User.FirstName} {lineup.Team.Coach.User.LastName}",
        lineup.Status,
        lineup.Notes,
        lineup.SubmittedAt,
        lineup.ReviewedAt,
        lineup.ReviewNote,
        @event = new
        {
            scheduleId = lineup.Schedule.ScheduleId,
            lineup.Schedule.Title,
            type = lineup.Schedule.ScheduleType,
            startDate = lineup.Schedule.StartDatetime.ToString("yyyy-MM-dd"),
            startTime = lineup.Schedule.StartDatetime.ToString("HH:mm:ss"),
            lineup.Schedule.Location,
            rules = DescribeRules(lineup.Schedule)
        },
        players = lineup.Players
            .OrderBy(player => player.Athlete.User.LastName).ThenBy(player => player.Athlete.User.FirstName)
            .Select(player => new
            {
                player.AthleteId,
                player.Position,
                player.Athlete.User.FirstName,
                player.Athlete.User.LastName,
                player.Athlete.StudentNumber,
                player.Athlete.Course,
                player.Athlete.YearLevel,
                eligibility = EligibilityService.Describe(checks.Eligibility.GetValueOrDefault(player.AthleteId)),
                problems = checks.Problems.GetValueOrDefault(player.AthleteId) ?? []
            })
    };

    private Task<EventLineup?> LoadLineupAsync(int lineupId, bool tracking = false)
    {
        var query = _context.EventLineups
            .Include(lineup => lineup.Schedule).ThenInclude(schedule => schedule.LineupSport)
            .Include(lineup => lineup.Team).ThenInclude(team => team.Sport)
            .Include(lineup => lineup.Team).ThenInclude(team => team.Coach!).ThenInclude(coach => coach.User)
            .Include(lineup => lineup.Players).ThenInclude(player => player.Athlete).ThenInclude(athlete => athlete.User)
            .AsSplitQuery();
        if (!tracking) query = query.AsNoTracking();
        return query.FirstOrDefaultAsync(lineup => lineup.LineupId == lineupId);
    }

    private Task<Team?> FindTeamAsync(int teamId) => _context.Teams
        .Include(team => team.Sport)
        .Include(team => team.TeamMembers).ThenInclude(member => member.Athlete).ThenInclude(athlete => athlete.User)
        .AsSplitQuery()
        .FirstOrDefaultAsync(team => team.TeamId == teamId);

    private async Task<bool> CanManageTeamAsync(Team team)
    {
        if (User.IsInRole("DIRECTOR")) return true;
        var coach = await CurrentCoachAsync();
        return coach != null && team.CoachId == coach.CoachId;
    }

    private async Task<CoachProfile?> CurrentCoachAsync()
    {
        if (!User.IsInRole("COACH")) return null;
        var userId = AthleteAccessService.GetUserId(User);
        return await _context.CoachProfiles.AsNoTracking().FirstOrDefaultAsync(coach => coach.UserId == userId);
    }
}

public sealed class LineupRulesRequest
{
    public int? SportId { get; set; }
    public int? MinPlayers { get; set; }
    public int? MaxPlayers { get; set; }
    public List<string>? RequiredDocuments { get; set; }
    public int? MaxAge { get; set; }
    public int? MaxYearLevel { get; set; }
}

public sealed class LineupRequest
{
    public int ScheduleId { get; set; }
    public int TeamId { get; set; }
    public List<LineupPlayerRequest>? Players { get; set; }
    public string? Notes { get; set; }
}

public sealed class LineupPlayerRequest
{
    public int AthleteId { get; set; }
    public string? Position { get; set; }
}

public sealed class LineupReviewRequest
{
    public bool Approve { get; set; }
    public string? Note { get; set; }
}
