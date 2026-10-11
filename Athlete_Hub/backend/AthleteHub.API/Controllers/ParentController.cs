using AthleteHub.API.Data;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

/// <summary>
/// Read-only view for parents: their linked children and those children's approved training sessions.
/// Parents never see other athletes, grades, documents, or unapproved sessions.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "PARENT")]
public class ParentController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public ParentController(AthleteHubDbContext context) => _context = context;

    /// <summary>The athletes linked to the signed-in parent, with their current teams.</summary>
    [HttpGet("children")]
    public async Task<IActionResult> GetChildren()
    {
        var parentUserId = AthleteAccessService.GetUserId(User);
        if (parentUserId == null) return Unauthorized();

        var children = await _context.ParentAthletes
            .Where(link => link.ParentUserId == parentUserId)
            .OrderBy(link => link.Athlete.User.FirstName)
            .Select(link => new
            {
                link.AthleteId,
                link.Relationship,
                link.Athlete.User.FirstName,
                link.Athlete.User.LastName,
                link.Athlete.User.AccountStatus,
                teams = link.Athlete.TeamMembers
                    .Where(member => member.DateLeft == null)
                    .Select(member => new { member.TeamId, member.Team.TeamName, sport = member.Team.Sport.SportName })
                    .ToList()
            })
            .ToListAsync();

        return Ok(children);
    }

    /// <summary>
    /// Approved training sessions for the parent's children, with each child's attendance.
    /// Pass <paramref name="athleteId"/> to narrow to one child.
    /// </summary>
    [HttpGet("training")]
    public async Task<IActionResult> GetTraining(int? athleteId = null, DateTime? from = null, DateTime? to = null)
    {
        var parentUserId = AthleteAccessService.GetUserId(User);
        if (parentUserId == null) return Unauthorized();

        var childIds = await _context.ParentAthletes
            .Where(link => link.ParentUserId == parentUserId)
            .Select(link => link.AthleteId)
            .ToListAsync();
        if (athleteId.HasValue)
        {
            if (!childIds.Contains(athleteId.Value)) return Forbid();
            childIds = [athleteId.Value];
        }
        if (childIds.Count == 0) return Ok(Array.Empty<object>());

        var query = _context.TrainingSessions
            .Where(session => (session.ApprovalStatus == "APPROVED" || session.ApprovalStatus == null)
                && session.Team.TeamMembers.Any(member => member.DateLeft == null && childIds.Contains(member.AthleteId)));
        if (from.HasValue) query = query.Where(session => session.TrainingDate >= from.Value.Date);
        if (to.HasValue) query = query.Where(session => session.TrainingDate <= to.Value.Date);

        var sessions = await query
            .OrderBy(session => session.TrainingDate).ThenBy(session => session.StartTime)
            .Select(session => new
            {
                session.TrainingSessionId,
                session.Title,
                session.Description,
                session.TrainingDate,
                session.StartTime,
                session.EndTime,
                session.Location,
                session.TeamId,
                teamName = session.Team.TeamName,
                coachName = session.Coach.User.FirstName + " " + session.Coach.User.LastName,
                // Only this parent's children on the team, never their teammates.
                children = session.Team.TeamMembers
                    .Where(member => member.DateLeft == null && childIds.Contains(member.AthleteId))
                    .Select(member => new
                    {
                        member.AthleteId,
                        member.Athlete.User.FirstName,
                        attendanceStatus = session.Attendances
                            .Where(attendance => attendance.AthleteId == member.AthleteId)
                            .Select(attendance => attendance.AttendanceStatus)
                            .FirstOrDefault(),
                        remarks = session.Attendances
                            .Where(attendance => attendance.AthleteId == member.AthleteId)
                            .Select(attendance => attendance.Remarks)
                            .FirstOrDefault()
                    })
                    .ToList()
            })
            .ToListAsync();

        return Ok(sessions.Select(session => new
        {
            id = $"training-{session.TrainingSessionId}",
            sourceId = session.TrainingSessionId,
            type = "TRAINING",
            session.Title,
            session.Description,
            startDate = session.TrainingDate.ToString("yyyy-MM-dd"),
            startTime = session.StartTime?.ToString(),
            endDate = session.TrainingDate.ToString("yyyy-MM-dd"),
            endTime = session.EndTime?.ToString(),
            session.Location,
            session.TeamId,
            session.teamName,
            session.coachName,
            session.children
        }));
    }
}
