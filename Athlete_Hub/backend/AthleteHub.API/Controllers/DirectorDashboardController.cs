using AthleteHub.API.Data;
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

    public DirectorDashboardController(AthleteHubDbContext context) => _context = context;

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
        var latestEligibility = (await _context.EligibilityRecords
                .AsNoTracking()
                .OrderByDescending(item => item.EvaluatedAt)
                .ThenByDescending(item => item.EligibilityId)
                .Select(item => new { item.AthleteId, item.AcademicStatus, Term = item.Term.Semester + " " + item.Term.AcademicYear })
                .ToListAsync())
            .GroupBy(item => item.AthleteId)
            .ToDictionary(group => group.Key, group => group.First());

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
                    athlete.Course,
                    athlete.YearLevel,
                    athlete.teams,
                    eligibilityStatus = latestEligibility.GetValueOrDefault(athlete.AthleteId)?.AcademicStatus,
                    eligibilityTerm = latestEligibility.GetValueOrDefault(athlete.AthleteId)?.Term,
                    attendanceRate = CoachDashboardController.AttendanceRate(attendance?.Attended, attendance?.Total)
                };
            }),
            portfolioItems
        });
    }
}
