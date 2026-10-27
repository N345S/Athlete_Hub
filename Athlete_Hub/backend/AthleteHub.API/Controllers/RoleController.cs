using AthleteHub.API.Data;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RoleController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public RoleController(AthleteHubDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetRoles()
    {
        // Hidden roles (Registrar, Admin) and the ICTD grades office are kept in the database but never offered.
        var roles = await _context.Roles
            .Where(r => !HiddenRoles.Unlisted.Contains(r.RoleName))
            .Select(r => new
            {
                r.RoleId,
                r.RoleName,
                r.Description
            })
            .ToListAsync();

        return Ok(roles);
    }
}