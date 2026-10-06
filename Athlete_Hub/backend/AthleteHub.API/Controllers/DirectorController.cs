using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/Director")]
[Authorize(Roles = "DIRECTOR")]
public class DirectorController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public DirectorController(AthleteHubDbContext context) => _context = context;

    // ==========================================
    // COACH MANAGEMENT
    // ==========================================

    /// <summary>
    /// Gets all coaches with their assigned athletes count.
    /// </summary>
    /// <returns>List of coaches with basic info and assigned athletes count</returns>
    [HttpGet("coaches")]
    public async Task<IActionResult> GetCoaches()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return Unauthorized(new { message = "Invalid or missing JWT token." });
        }

        var coaches = await _context.CoachProfiles
            .Include(c => c.User)
            .Include(c => c.Teams)
                .ThenInclude(t => t.TeamMembers.Where(tm => tm.DateLeft == null))
                    .ThenInclude(tm => tm.Athlete)
                        .ThenInclude(a => a.User)
            .Select(c => new
            {
                c.CoachId,
                firstName = c.User.FirstName,
                accountStatus = c.User.AccountStatus,
                lastName = c.User.LastName,
                email = c.User.Email,
                c.Specialization,
                c.User.Phone,
                assignedAthletesCount = c.Teams
                    .SelectMany(t => t.TeamMembers.Where(tm => tm.DateLeft == null))
                    .Select(tm => tm.AthleteId)
                    .Distinct()
                    .Count(),
                teams = c.Teams.Select(t => new
                {
                    t.TeamId,
                    t.TeamName,
                    t.Status,
                    athletesCount = t.TeamMembers.Count(tm => tm.DateLeft == null)
                })
            })
            .OrderBy(c => c.lastName)
            .ThenBy(c => c.firstName)
            .ToListAsync();

        return Ok(new { coaches });
    }

    /// <summary>
    /// Gets a coach's profile with their assigned athletes.
    /// </summary>
    /// <param name="coachId">The coach ID</param>
    /// <returns>Coach profile with assigned athletes (instead of portfolios)</returns>
    [HttpGet("coaches/{coachId}")]
    public async Task<IActionResult> GetCoachProfile(int coachId)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return Unauthorized(new { message = "Invalid or missing JWT token." });
        }

        var coach = await _context.CoachProfiles
            .Include(c => c.User)
            .Include(c => c.Teams)
                .ThenInclude(t => t.TeamMembers.Where(tm => tm.DateLeft == null))
                    .ThenInclude(tm => tm.Athlete)
                        .ThenInclude(a => a.User)
            .FirstOrDefaultAsync(c => c.CoachId == coachId);

        if (coach == null)
        {
            return NotFound(new { message = $"Coach with ID {coachId} not found." });
        }

        // Get all assigned athletes across all teams (distinct)
        var assignedAthletes = coach.Teams
            .SelectMany(t => t.TeamMembers
                    .Where(tm => tm.DateLeft == null)
                    .Select(tm => new
                {
                    tm.Athlete.AthleteId,
                    studentNumber = tm.Athlete.StudentNumber,
                    firstName = tm.Athlete.User.FirstName,
                    lastName = tm.Athlete.User.LastName,
                    tm.Athlete.User.Email,
                    tm.Athlete.User.Phone,
                    tm.Athlete.Course,
                    tm.Athlete.YearLevel,
                    tm.DateJoined,
                    teamName = tm.Team.TeamName,
                    teamId = tm.Team.TeamId
                }))
            .GroupBy(a => a.AthleteId)
            .Select(g => g.First())
            .OrderBy(a => a.lastName)
            .ThenBy(a => a.firstName)
            .ToList();

        var teams = coach.Teams.Select(t => new
        {
            t.TeamId,
            t.TeamName,
            t.SportId,
            t.Status,
            t.SchoolYear,
            athletesCount = t.TeamMembers.Count(tm => tm.DateLeft == null)
        }).ToList();

        return Ok(new
        {
            coachId = coach.CoachId,
            firstName = coach.User.FirstName,
            lastName = coach.User.LastName,
            email = coach.User.Email,
            phone = coach.User.Phone,
            specialization = coach.Specialization,
            assignedAthletes = assignedAthletes,
            totalAssignedAthletes = assignedAthletes.Count,
            teams
        });
    }

    /// <summary>
    /// Assigns an athlete to a coach by adding them to a coach's team.
    /// </summary>
    /// <param name="coachId">The coach ID</param>
    /// <param name="athleteId">The athlete ID to assign</param>
    /// <returns>Assignment result</returns>
    [HttpPost("coaches/{coachId}/assign-athlete")]
    public async Task<IActionResult> AssignAthleteToCoach(int coachId, [FromBody] AssignAthleteRequest request)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return Unauthorized(new { message = "Invalid or missing JWT token." });
        }

        var athleteId = request.AthleteId;

        var coach = await _context.CoachProfiles
            .Include(c => c.User)
            .FirstOrDefaultAsync(c => c.CoachId == coachId);

        if (coach == null)
        {
            return NotFound(new { message = $"Coach with ID {coachId} not found." });
        }

        var athlete = await _context.AthleteProfiles
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.AthleteId == athleteId);

        if (athlete == null)
        {
            return NotFound(new { message = $"Athlete with ID {athleteId} not found." });
        }

        // Find an active team for this coach
        var team = await _context.Teams
            .FirstOrDefaultAsync(t => t.CoachId == coachId && t.Status == "ACTIVE");

        if (team == null)
        {
            return BadRequest(new { message = $"Coach is not assigned to any active team." });
        }

        // Check if athlete is already on this team
        var existingTeamMember = await _context.TeamMembers
            .FirstOrDefaultAsync(tm => tm.TeamId == team.TeamId && tm.AthleteId == athleteId && tm.DateLeft == null);

        if (existingTeamMember != null)
        {
            return Conflict(new { message = $"Athlete is already assigned to team '{team.TeamName}'." });
        }

        var teamMember = new TeamMember
        {
            TeamId = team.TeamId,
            AthleteId = athleteId,
            DateJoined = DateTime.UtcNow,
            DateLeft = null
        };

        _context.TeamMembers.Add(teamMember);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"Athlete assigned to coach '{coach.User.FirstName} {coach.User.LastName}' on team '{team.TeamName}'.",
            teamId = team.TeamId,
            teamName = team.TeamName,
            athleteId = athlete.AthleteId,
            athleteName = $"{athlete.User.FirstName} {athlete.User.LastName}",
            dateJoined = teamMember.DateJoined
        });
    }

    /// <summary>
    /// Unassigns an athlete from a coach (removes from team).
    /// </summary>
    /// <param name="coachId">The coach ID</param>
    /// <param name="athleteId">The athlete ID to unassign</param>
    /// <returns>Unassignment result</returns>
    [HttpDelete("coaches/{coachId}/unassign-athlete/{athleteId}")]
    public async Task<IActionResult> UnassignAthleteFromCoach(int coachId, int athleteId)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return Unauthorized(new { message = "Invalid or missing JWT token." });
        }

        var coach = await _context.CoachProfiles
            .FirstOrDefaultAsync(c => c.CoachId == coachId);

        if (coach == null)
        {
            return NotFound(new { message = $"Coach with ID {coachId} not found." });
        }

        var athlete = await _context.AthleteProfiles
            .FirstOrDefaultAsync(a => a.AthleteId == athleteId);

        if (athlete == null)
        {
            return NotFound(new { message = $"Athlete with ID {athleteId} not found." });
        }

        // Find the team member record for this coach's team
        var teamIds = await _context.Teams
            .Where(t => t.CoachId == coachId)
            .Select(t => t.TeamId)
            .ToListAsync();

        var teamMember = await _context.TeamMembers
            .FirstOrDefaultAsync(tm => teamIds.Contains(tm.TeamId) && tm.AthleteId == athleteId && tm.DateLeft == null);

        if (teamMember == null)
        {
            return NotFound(new { message = "Athlete is not assigned to this coach." });
        }

        teamMember.DateLeft = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Athlete unassigned from coach successfully." });
    }

    // ==========================================
    // ATHLETE MANAGEMENT (similar to coaches view)
    // ==========================================

    /// <summary>
    /// Gets all athletes for assignment purposes.
    /// </summary>
    [HttpGet("athletes")]
    public async Task<IActionResult> GetAthletes()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return Unauthorized(new { message = "Invalid or missing JWT token." });
        }

        var athletes = await _context.AthleteProfiles
            .Include(a => a.User)
            .Include(a => a.TeamMembers.Where(tm => tm.DateLeft == null))
                    .ThenInclude(tm => tm.Team)
                    .ThenInclude(t => t.Coach)
                        .ThenInclude(c => c!.User)
            .Select(a => new
            {
                a.AthleteId,
                studentNumber = a.StudentNumber,
                firstName = a.User.FirstName,
                lastName = a.User.LastName,
                email = a.User.Email,
                a.User.Phone,
                a.Course,
                a.YearLevel,
                accountStatus = a.User.AccountStatus,
                currentCoach = a.TeamMembers
                    .Where(tm => tm.DateLeft == null && tm.Team.Coach != null && tm.Team.Coach.User != null)
                    .Select(tm => new
                    {
                        coachId = tm.Team.Coach!.CoachId,
                        coachName = tm.Team.Coach!.User!.FirstName + " " + tm.Team.Coach!.User!.LastName,
                        teamName = tm.Team.TeamName,
                        tm.DateJoined
                    })
                    .FirstOrDefault()
            })
            .OrderBy(a => a.lastName)
            .ThenBy(a => a.firstName)
            .ToListAsync();

        return Ok(new { athletes });
    }
}

public class AssignAthleteRequest
{
    public int AthleteId { get; set; }
}
