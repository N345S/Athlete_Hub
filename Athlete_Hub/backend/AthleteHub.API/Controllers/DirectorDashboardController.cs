using AthleteHub.API.Data;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/DirectorDashboard")]
[Authorize(Roles = "DIRECTOR")]
public class DirectorDashboardController : ControllerBase
{
    private readonly AthleteHubDbContext _context;
    private readonly IctdGradeSyncWorker _gradeSync;
    private readonly EligibilityService _eligibility;
    private readonly AppClock _clock;

    public DirectorDashboardController(AthleteHubDbContext context, IctdGradeSyncWorker gradeSync, EligibilityService eligibility, AppClock clock)
    {
        _context = context;
        _gradeSync = gradeSync;
        _eligibility = eligibility;
        _clock = clock;
    }

    [HttpGet]
    public async Task<IActionResult> GetDashboard()
    {
        var athletes = await _context.AthleteProfiles
            .AsNoTracking()
            .Include(athlete => athlete.User)
            .Include(athlete => athlete.TeamMembers).ThenInclude(member => member.Team).ThenInclude(team => team.Sport)
            .Select(athlete => new
            {
                athlete.AthleteId,
                athlete.StudentNumber,
                firstName = athlete.User.FirstName,
                lastName = athlete.User.LastName,
                accountStatus = athlete.User.AccountStatus,
                athlete.Course,
                athlete.YearLevel,
                teams = athlete.TeamMembers
                    .Where(member => member.DateLeft == null)
                    .Select(member => new
                    {
                        member.Team.TeamId,
                        member.Team.TeamName,
                        sport = member.Team.Sport.SportName
                    })
                    .ToList()
            })
            .ToListAsync();

        var attendanceByAthlete = await _context.Attendances
            .GroupBy(item => item.AthleteId)
            .Select(group => new
            {
                AthleteId = group.Key,
                Total = group.Count(),
                Attended = group.Count(item => item.AttendanceStatus == "PRESENT" || item.AttendanceStatus == "LATE")
            })
            .ToDictionaryAsync(item => item.AthleteId);
        // Rule-based eligibility (Services/EligibilityService.cs); coaches are told when someone becomes restricted.
        var eligibility = await _eligibility.RefreshAsync();

        // What the Director acts on, beyond training approvals: lineups to approve and unanswered coach evaluations.
        var today = _clock.LocalToday;
        var pendingLineups = await _context.EventLineups
            .CountAsync(lineup => lineup.Status == "PENDING" && lineup.Schedule.CancelledAt == null && lineup.Schedule.StartDatetime >= today);
        var latestEvaluationTerm = await _context.CoachEvaluations
            .OrderByDescending(evaluation => evaluation.SentAt)
            .Select(evaluation => new { evaluation.TermId, evaluation.Term.Semester, evaluation.Term.AcademicYear })
            .FirstOrDefaultAsync();
        object? coachEvaluations = null;
        if (latestEvaluationTerm != null)
        {
            var termEvaluations = _context.CoachEvaluations.Where(evaluation => evaluation.TermId == latestEvaluationTerm.TermId);
            coachEvaluations = new
            {
                term = $"{latestEvaluationTerm.Semester} {latestEvaluationTerm.AcademicYear}",
                sent = await termEvaluations.CountAsync(),
                pending = await termEvaluations.CountAsync(evaluation => evaluation.Status == "PENDING")
            };
        }

        var portfolioItems = await _context.PortfolioItems
            .AsNoTracking()
            .Select(item => new
            {
                item.PortfolioItemId,
                item.AthleteId,
                item.Title,
                item.CreatedAt,
                item.VerificationStatus,
                athleteName = item.Athlete.User.FirstName + " " + item.Athlete.User.LastName,
                studentNumber = item.Athlete.StudentNumber
            })
            .OrderByDescending(item => item.CreatedAt)
            .Take(50)
            .ToListAsync();

        return Ok(new
        {
            athleteCount = athletes.Count,
            athletes = athletes.Select(athlete =>
            {
                attendanceByAthlete.TryGetValue(athlete.AthleteId, out var attendance);
                return new
                {
                    athlete.AthleteId,
                    athlete.StudentNumber,
                    athlete.firstName,
                    athlete.lastName,
                    athlete.accountStatus,
                    athlete.Course,
                    athlete.YearLevel,
                    athlete.teams,
                    eligibilityStatus = eligibility.GetValueOrDefault(athlete.AthleteId)?.Status ?? EligibilityService.UnderReview,
                    eligibilityReasons = eligibility.GetValueOrDefault(athlete.AthleteId)?.Reasons ?? [],
                    eligibilityTerm = eligibility.GetValueOrDefault(athlete.AthleteId)?.Term,
                    attendanceRate = CoachDashboardController.AttendanceRate(attendance?.Attended, attendance?.Total)
                };
            }),
            portfolioItems,
            pendingLineups,
            coachEvaluations
        });
    }

    /// <summary>
    /// When the ICTD database was last checked and which term was pulled most recently. No grades are included, so
    /// the dashboard can show this without the password that the Grades page needs.
    /// </summary>
    [HttpGet("grade-sync")]
    public async Task<IActionResult> GetGradeSync()
    {
        var terms = await _context.AcademicRecords
            .Where(record => record.SourceType == IctdGradeSync.IctdSource)
            .GroupBy(record => new { record.TermId, record.Term.AcademicYear, record.Term.Semester })
            .Select(group => new
            {
                group.Key.TermId,
                group.Key.AcademicYear,
                group.Key.Semester,
                athletes = group.Select(record => record.AthleteId).Distinct().Count(),
                pulledAt = group.Max(record => record.ImportedAt)
            })
            .ToListAsync();
        var latest = terms
            .OrderByDescending(term => term.AcademicYear)
            .ThenByDescending(term => Array.IndexOf(IctdUniversityDatabase.Semesters, term.Semester))
            .FirstOrDefault();

        object? latestTerm = null;
        if (latest != null)
        {
            var evaluations = _context.CoachEvaluations.Where(evaluation => evaluation.TermId == latest.TermId);
            latestTerm = new
            {
                latest.AcademicYear,
                latest.Semester,
                latest.athletes,
                latest.pulledAt,
                evaluationsSent = await evaluations.CountAsync(),
                evaluationsSubmitted = await evaluations.CountAsync(evaluation => evaluation.Status == "SUBMITTED")
            };
        }

        return Ok(new
        {
            latestTerm,
            lastCheckedAt = _gradeSync.LastCheckedAt,
            nextCheckAt = _gradeSync.NextCheckAt,
            lastCheckFailed = _gradeSync.LastCheckFailed,
            intervalMinutes = (int)_gradeSync.Interval.TotalMinutes
        });
    }
}
