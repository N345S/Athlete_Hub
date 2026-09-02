using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.DTOs;
using AthleteHub.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TrainingController : ControllerBase
{
    private static readonly string[] ValidStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
    private readonly AthleteHubDbContext _context;

    public TrainingController(AthleteHubDbContext context) => _context = context;

    [HttpGet("sessions")]
    public async Task<IActionResult> GetSessions(DateTime? from = null, DateTime? to = null)
    {
        var query = _context.TrainingSessions.Include(session => session.Team).AsQueryable();
        if (User.IsInRole("COACH"))
        {
            var coach = await GetCoachAsync();
            if (coach == null) return Forbid();
            query = query.Where(session => session.Team.CoachId == coach.CoachId);
        }
        else if (User.IsInRole("ATHLETE"))
        {
            if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Unauthorized();
            query = query.Where(session => session.Team.TeamMembers.Any(member => member.Athlete.UserId == userId && member.DateLeft == null));
        }
        if (from.HasValue) query = query.Where(session => session.TrainingDate >= from.Value.Date);
        if (to.HasValue) query = query.Where(session => session.TrainingDate <= to.Value.Date);
        return Ok(await query.OrderBy(session => session.TrainingDate).Select(session => new { session.TrainingSessionId, session.TeamId, teamName = session.Team.TeamName, session.Title, session.Description, session.TrainingDate, session.StartTime, session.EndTime, session.Location }).ToListAsync());
    }

    [HttpPost("sessions")]
    [Authorize(Roles = "COACH")]
    public async Task<IActionResult> CreateSession(TrainingSessionRequest request)
    {
        var coach = await GetCoachAsync();
        if (coach == null || !await _context.Teams.AnyAsync(team => team.TeamId == request.TeamId && team.CoachId == coach.CoachId)) return Forbid();
        if (request.EndTime.HasValue && request.StartTime.HasValue && request.EndTime <= request.StartTime) return BadRequest(new { message = "End time must be after start time." });
        var session = new TrainingSession { TeamId = request.TeamId, CoachId = coach.CoachId, Title = request.Title.Trim(), Description = request.Description, TrainingDate = request.TrainingDate.Date, StartTime = request.StartTime, EndTime = request.EndTime, Location = request.Location };
        _context.TrainingSessions.Add(session);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetSessions), new { id = session.TrainingSessionId }, new { session.TrainingSessionId });
    }

    [HttpGet("sessions/{sessionId}/attendance")]
    public async Task<IActionResult> GetAttendance(int sessionId)
    {
        var session = await _context.TrainingSessions.Include(item => item.Team).FirstOrDefaultAsync(item => item.TrainingSessionId == sessionId);
        if (session == null) return NotFound(new { message = "Training session not found." });
        if (!await CanViewTeamAsync(session.TeamId)) return Forbid();
        return Ok(await _context.Attendances.Where(attendance => attendance.TrainingSessionId == sessionId).Select(attendance => new { attendance.AttendanceId, attendance.AthleteId, attendance.AttendanceStatus, attendance.Remarks }).ToListAsync());
    }

    [HttpPost("sessions/{sessionId}/attendance")]
    [Authorize(Roles = "COACH")]
    public async Task<IActionResult> MarkAttendance(int sessionId, AttendanceRequest request)
    {
        var coach = await GetCoachAsync();
        var session = await _context.TrainingSessions.FirstOrDefaultAsync(item => item.TrainingSessionId == sessionId);
        if (coach == null || session == null) return NotFound(new { message = "Training session not found." });
        if (!await _context.Teams.AnyAsync(team => team.TeamId == session.TeamId && team.CoachId == coach.CoachId)) return Forbid();
        if (!ValidStatuses.Contains(request.AttendanceStatus.Trim().ToUpperInvariant())) return BadRequest(new { message = "Attendance status must be PRESENT, ABSENT, LATE, or EXCUSED." });
        if (!await _context.TeamMembers.AnyAsync(member => member.TeamId == session.TeamId && member.AthleteId == request.AthleteId && member.DateLeft == null)) return BadRequest(new { message = "Athlete is not an active member of this team." });
        var attendance = await _context.Attendances.FirstOrDefaultAsync(item => item.TrainingSessionId == sessionId && item.AthleteId == request.AthleteId);
        if (attendance == null) { attendance = new Attendance { TrainingSessionId = sessionId, AthleteId = request.AthleteId }; _context.Attendances.Add(attendance); }
        attendance.AttendanceStatus = request.AttendanceStatus.Trim().ToUpperInvariant();
        attendance.Remarks = request.Remarks;
        await _context.SaveChangesAsync();
        return Ok(new { attendance.AttendanceId, attendance.TrainingSessionId, attendance.AthleteId, attendance.AttendanceStatus });
    }

    private async Task<CoachProfile?> GetCoachAsync()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return null;
        return await _context.CoachProfiles.FirstOrDefaultAsync(coach => coach.UserId == userId);
    }

    private async Task<bool> CanViewTeamAsync(int teamId)
    {
        if (User.IsInRole("ADMIN") || User.IsInRole("DIRECTOR") || User.IsInRole("REGISTRAR")) return true;
        var coach = await GetCoachAsync();
        if (coach != null) return await _context.Teams.AnyAsync(team => team.TeamId == teamId && team.CoachId == coach.CoachId);
        if (User.IsInRole("ATHLETE") && int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return await _context.TeamMembers.AnyAsync(member => member.TeamId == teamId && member.Athlete.UserId == userId && member.DateLeft == null);
        return false;
    }
}
