using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/CoachDashboard")]
[Authorize(Roles = "COACH")]
public class CoachDashboardController : ControllerBase
{
    private readonly AthleteHubDbContext _context;
    private readonly AppClock _clock;
    private readonly EligibilityService _eligibilityService;

    public CoachDashboardController(AthleteHubDbContext context, AppClock clock, EligibilityService eligibilityService)
    {
        _context = context;
        _clock = clock;
        _eligibilityService = eligibilityService;
    }

    [HttpGet]
    public async Task<IActionResult> GetDashboard()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Unauthorized();
        var coach = await _context.CoachProfiles.FirstOrDefaultAsync(item => item.UserId == userId);
        if (coach == null)
        {
            return Ok(new
            {
                coachId = (int?)null,
                userId,
                teamCount = 0,
                athleteCount = 0,
                teams = Array.Empty<object>(),
                attendance = Array.Empty<object>(),
                eligibility = Array.Empty<object>(),
                upcomingSessions = Array.Empty<object>(),
                portfolioItems = Array.Empty<object>(),
                message = "Your coach account has no team yet. Please ask the Sports Director to set one up."
            });
        }

        var teams = await _context.Teams
            .Include(team => team.Sport)
            .Include(team => team.TeamMembers).ThenInclude(member => member.Athlete).ThenInclude(athlete => athlete.User)
            .Where(team => team.CoachId == coach.CoachId)
            .ToListAsync();
        var teamIds = teams.Select(team => team.TeamId).ToList();
        var athleteIds = teams.SelectMany(team => team.TeamMembers.Where(member => member.DateLeft == null).Select(member => member.AthleteId)).Distinct().ToList();

        var attendance = await _context.Attendances
            .Include(item => item.TrainingSession)
            .Where(item => athleteIds.Contains(item.AthleteId) && teamIds.Contains(item.TrainingSession.TeamId))
            .GroupBy(item => item.AttendanceStatus)
            .Select(group => new { status = group.Key, count = group.Count() })
            .ToListAsync();
        var latestEligibility = await _eligibilityService.RefreshAsync(athleteIds);
        var attendanceByAthlete = await _context.Attendances
            .Where(item => athleteIds.Contains(item.AthleteId) && teamIds.Contains(item.TrainingSession.TeamId))
            .GroupBy(item => item.AthleteId)
            .Select(group => new
            {
                AthleteId = group.Key,
                Total = group.Count(),
                Attended = group.Count(item => item.AttendanceStatus == "PRESENT" || item.AttendanceStatus == "LATE")
            })
            .ToDictionaryAsync(item => item.AthleteId);
        var eligibility = latestEligibility.Values
            .GroupBy(item => item.Status)
            .Select(group => new { status = group.Key, count = group.Count() })
            .ToList();
        // This coach's lineups for upcoming events, so returned ones can be fixed in time.
        var today = _clock.LocalToday;
        var lineups = await _context.EventLineups
            .Where(lineup => teamIds.Contains(lineup.TeamId) && lineup.Schedule.CancelledAt == null && lineup.Schedule.StartDatetime >= today)
            .Select(lineup => new { lineup.Status })
            .ToListAsync();
        var upcomingSessions = await _context.TrainingSessions
            .Where(item => teamIds.Contains(item.TeamId) && item.TrainingDate >= _clock.LocalToday)
            .OrderBy(item => item.TrainingDate)
            .Take(10)
            .Select(item => new { item.TrainingSessionId, item.TeamId, item.Title, item.TrainingDate, item.StartTime, item.EndTime, item.Location, item.ApprovalStatus })
            .ToListAsync();

        var portfolioItems = await _context.PortfolioItems
            .Include(item => item.Athlete).ThenInclude(a => a.User)
            .Include(item => item.Achievement)
            .Where(item => athleteIds.Contains(item.AthleteId))
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => new
            {
                item.PortfolioItemId,
                item.AchievementId,
                item.Title,
                item.Description,
                item.CreatedAt,
                item.VerificationStatus,
                item.RejectionReason,
                item.VerifiedAt,
                item.IsVisible,
                athleteId = item.AthleteId,
                athleteName = item.Athlete.User.FirstName + " " + item.Athlete.User.LastName,
                studentNumber = item.Athlete.StudentNumber,
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
            coachId = coach.CoachId,
            teamCount = teams.Count,
            athleteCount = athleteIds.Count,
            teams = teams.Select(team => new
            {
                team.TeamId,
                team.TeamName,
                sport = team.Sport.SportName,
                athleteCount = team.TeamMembers.Count(member => member.DateLeft == null),
                athletes = team.TeamMembers.Where(member => member.DateLeft == null).Select(member => new
                {
                    member.AthleteId,
                    member.Athlete.User.FirstName,
                    member.Athlete.User.LastName,
                    member.Athlete.StudentNumber,
                    member.Athlete.User.AccountStatus,
                    member.Athlete.Course,
                    member.Athlete.YearLevel,
                    eligibilityStatus = latestEligibility.GetValueOrDefault(member.AthleteId)?.Status ?? EligibilityService.UnderReview,
                    eligibilityReasons = latestEligibility.GetValueOrDefault(member.AthleteId)?.Reasons ?? [],
                    eligibilityTerm = latestEligibility.GetValueOrDefault(member.AthleteId)?.Term,
                    attendanceRate = AttendanceRate(attendanceByAthlete.GetValueOrDefault(member.AthleteId)?.Attended, attendanceByAthlete.GetValueOrDefault(member.AthleteId)?.Total)
                })
            }),
            attendance,
            eligibility,
            upcomingSessions = upcomingSessions.Select(session => new
            {
                session.TrainingSessionId,
                session.TeamId,
                session.Title,
                trainingDate = session.TrainingDate.ToString("yyyy-MM-dd"),
                session.StartTime,
                session.EndTime,
                session.Location,
                session.ApprovalStatus
            }),
            portfolioItems,
            lineups = new
            {
                pending = lineups.Count(lineup => lineup.Status == "PENDING"),
                returned = lineups.Count(lineup => lineup.Status == "REJECTED"),
                approved = lineups.Count(lineup => lineup.Status == "APPROVED")
            }
        });
    }

    /// <summary>
    /// Percentage of recorded sessions attended (present or late), or null when nothing is recorded.
    /// </summary>
    internal static int? AttendanceRate(int? attended, int? total) =>
        total is > 0 ? (int)Math.Round(100.0 * (attended ?? 0) / total.Value) : null;
}
