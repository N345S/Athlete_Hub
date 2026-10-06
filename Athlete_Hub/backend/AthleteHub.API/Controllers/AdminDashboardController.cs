using AthleteHub.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

/// <summary>
/// Account overview for administrators. Admins manage accounts only, so nothing here
/// exposes athlete records, portfolios, or teams.
/// </summary>
[ApiController]
[Route("api/AdminDashboard")]
[Authorize(Roles = "ADMIN")]
public class AdminDashboardController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public AdminDashboardController(AthleteHubDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetDashboard()
    {
        var counts = await _context.Users
            .AsNoTracking()
            .GroupBy(user => new { user.Role.RoleName, user.AccountStatus })
            .Select(group => new { group.Key.RoleName, group.Key.AccountStatus, Count = group.Count() })
            .ToListAsync();

        var byRole = counts
            .GroupBy(item => item.RoleName)
            .Select(group => new
            {
                role = group.Key,
                total = group.Sum(item => item.Count),
                active = group.Where(item => item.AccountStatus == "ACTIVE").Sum(item => item.Count),
                inactive = group.Where(item => item.AccountStatus == "INACTIVE").Sum(item => item.Count),
                suspended = group.Where(item => item.AccountStatus == "SUSPENDED").Sum(item => item.Count)
            })
            .OrderBy(item => item.role)
            .ToList();

        var recentAccounts = await _context.Users
            .AsNoTracking()
            .OrderByDescending(user => user.CreatedAt)
            .ThenByDescending(user => user.UserId)
            .Take(8)
            .Select(user => new
            {
                user.UserId,
                user.FirstName,
                user.LastName,
                user.Email,
                role = user.Role.RoleName,
                user.AccountStatus,
                user.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            totalAccounts = counts.Sum(item => item.Count),
            active = counts.Where(item => item.AccountStatus == "ACTIVE").Sum(item => item.Count),
            inactive = counts.Where(item => item.AccountStatus == "INACTIVE").Sum(item => item.Count),
            suspended = counts.Where(item => item.AccountStatus == "SUSPENDED").Sum(item => item.Count),
            byRole,
            recentAccounts
        });
    }
}
