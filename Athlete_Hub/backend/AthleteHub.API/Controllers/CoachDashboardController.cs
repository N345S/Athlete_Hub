using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.Models;
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

    public CoachDashboardController(AthleteHubDbContext context) => _context = context;

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
                message = "Coach account is valid, but no coach profile or assigned teams have been configured yet."
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
        var eligibility = await _context.EligibilityRecords
            .Where(item => athleteIds.Contains(item.AthleteId))
            .GroupBy(item => item.AcademicStatus)
            .Select(group => new { status = group.Key, count = group.Count() })
            .ToListAsync();
        var upcomingSessions = await _context.TrainingSessions
            .Where(item => teamIds.Contains(item.TeamId) && item.TrainingDate >= DateTime.UtcNow.Date)
            .OrderBy(item => item.TrainingDate)
            .Take(10)
            .Select(item => new { item.TrainingSessionId, item.TeamId, item.Title, item.TrainingDate, item.StartTime, item.EndTime, item.Location })
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
                    member.Athlete.StudentNumber
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
                session.Location
            })
        });
    }
}
