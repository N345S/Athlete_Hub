using AthleteHub.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/RegistrarDashboard")]
[Authorize(Roles = "REGISTRAR")]
public class RegistrarDashboardController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public RegistrarDashboardController(AthleteHubDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetDashboard()
    {
        var students = await _context.AthleteProfiles
            .AsNoTracking()
            .Select(athlete => new
            {
                athleteId = athlete.AthleteId,
                studentNumber = athlete.StudentNumber,
                firstName = athlete.User.FirstName,
                lastName = athlete.User.LastName,
                course = athlete.Course,
                yearLevel = athlete.YearLevel
            })
            .OrderBy(athlete => athlete.lastName)
            .ThenBy(athlete => athlete.firstName)
            .ToListAsync();

        return Ok(new { students });
    }
}
