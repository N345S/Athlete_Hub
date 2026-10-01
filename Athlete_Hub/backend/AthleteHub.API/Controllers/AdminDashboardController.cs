using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/AdminDashboard")]
[Authorize(Roles = "ADMIN")]
public class AdminDashboardController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public AdminDashboardController(AthleteHubDbContext context) => _context = context;

    [HttpGet]
    public IActionResult GetDashboard()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Unauthorized();

        // Overview statistics
        var totalAthletes = _context.AthleteProfiles.Count();
        var totalCoaches = _context.CoachProfiles.Count();
        var totalTeams = _context.Teams.Count();
        var totalAchievements = _context.Achievements.Count();
        var totalPortfolioItems = _context.PortfolioItems.Count();
        var totalDocuments = _context.Documents.Count();

        // Athletes by account status - join with Users
        var users = _context.Users.Include(u => u.AthleteProfile).ToList();
        var athletesByStatus = users
            .Where(u => u.AthleteProfile != null)
            .GroupBy(u => u.AccountStatus)
            .Select(g => new { status = g.Key, count = g.Count() })
            .ToList();

        // Achievements by verification status
        var achievementsByStatus = _context.Achievements
            .GroupBy(a => a.VerificationStatus)
            .Select(g => new { status = g.Key, count = g.Count() })
            .ToList();

        // Recent portfolio activities
        var recentActivities = _context.PortfolioItems
            .Include(i => i.Athlete).ThenInclude(a => a.User)
            .Include(i => i.Achievement)
            .OrderByDescending(i => i.CreatedAt)
            .Take(10)
            .Select(i => new
            {
                i.PortfolioItemId,
                i.Title,
                athleteName = i.Athlete.User != null ? i.Athlete.User.FirstName + " " + i.Athlete.User.LastName : "Unknown",
                achievementStatus = i.Achievement != null ? i.Achievement.VerificationStatus : "None",
                i.CreatedAt
            })
            .ToList();

        // Recent achievements
        var recentAchievements = _context.Achievements
            .Include(a => a.Athlete).ThenInclude(a => a.User)
            .OrderByDescending(a => a.CreatedAt)
            .Take(10)
            .Select(a => new
            {
                a.AchievementId,
                a.Title,
                athleteName = a.Athlete != null && a.Athlete.User != null ? a.Athlete.User.FirstName + " " + a.Athlete.User.LastName : "Unknown",
                a.VerificationStatus,
                a.CreatedAt
            })
            .ToList();

        // Recent teams
        var teams = _context.Teams
            .Include(t => t.Sport)
            .Include(t => t.Coach).ThenInclude(c => c!.User)
            .Take(10)
            .Select(t => new
            {
                t.TeamId,
                t.TeamName,
                sport = t.Sport != null ? t.Sport.SportName : "Unassigned",
                coachName = t.Coach != null && t.Coach.User != null ? t.Coach.User.FirstName + " " + t.Coach.User.LastName : "Unassigned",
                t.Status
            })
            .ToList();

        return Ok(new
        {
            overview = new
            {
                totalAthletes,
                totalCoaches,
                totalTeams,
                totalAchievements,
                totalPortfolioItems,
                totalDocuments,
                athletesByStatus,
                achievementsByStatus
            },
            recentActivities,
            recentAchievements,
            teams
        });
    }
}
