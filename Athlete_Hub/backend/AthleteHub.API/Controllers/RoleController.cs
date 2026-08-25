using AthleteHub.API.Data;
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
        var roles = await _context.Roles
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