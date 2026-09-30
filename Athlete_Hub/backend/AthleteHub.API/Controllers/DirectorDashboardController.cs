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

        var portfolioItems = await _context.PortfolioItems
            .AsNoTracking()
            .Where(item => item.AthleteId != 0)
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
            .ToListAsync();

        return Ok(new
        {
            athleteCount = athletes.Count,
            teams = Array.Empty<object>(),
            athletes,
            portfolioItems
        });
    }
}
