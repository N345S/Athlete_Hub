using AthleteHub.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "ADMIN")]
public class AdminController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public AdminController(AthleteHubDbContext context)
    {
        _context = context;
    }

    // ==========================================
    // GET ALL USERS
    // GET: /api/Admin/users
    // ==========================================

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _context.Users
            .Include(u => u.Role)
            .Select(u => new
            {
                u.UserId,
                u.UniversityId,
                u.Email,
                u.FirstName,
                u.MiddleName,
                u.LastName,
                u.Phone,
                u.AccountStatus,
                u.CreatedAt,
                u.UpdatedAt,
                Role = u.Role.RoleName
            })
            .ToListAsync();

        return Ok(new
        {
            endpoint = "GET /api/Admin/users",
            count = users.Count,
            users
        });
    }
}