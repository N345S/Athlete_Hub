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
            query = query.Where(session => (session.ApprovalStatus == "APPROVED" || session.ApprovalStatus == null) && session.Team.TeamMembers.Any(member => member.Athlete.UserId == userId && member.DateLeft == null));
        }
        if (from.HasValue) query = query.Where(session => session.TrainingDate >= from.Value.Date);
        if (to.HasValue) query = query.Where(session => session.TrainingDate <= to.Value.Date);
        var sessions = await query
            .OrderBy(session => session.TrainingDate)
            .Select(session => new { session.TrainingSessionId, session.TeamId, teamName = session.Team.TeamName, session.Title, session.Description, session.TrainingDate, session.StartTime, session.EndTime, session.Location, session.ApprovalStatus, session.SubmittedAt, session.ReviewedAt, session.RejectionReason })
            .ToListAsync();

        return Ok(sessions.Select(session => new
        {
            session.TrainingSessionId,
            session.TeamId,
            session.teamName,
            session.Title,
            session.Description,
            trainingDate = session.TrainingDate.ToString("yyyy-MM-dd"),
            session.StartTime,
            session.EndTime,
            session.Location,
            session.ApprovalStatus,
            session.SubmittedAt,
            session.ReviewedAt,
            session.RejectionReason
        }));
    }

    [HttpGet("pending")]
    [Authorize(Roles = "DIRECTOR")]
    public async Task<IActionResult> GetPendingSessions()
    {
        var sessions = await _context.TrainingSessions
            .Include(session => session.Team).ThenInclude(team => team.Sport)
            .Include(session => session.Coach).ThenInclude(coach => coach.User)
            .Where(session => session.ApprovalStatus == "PENDING")
            .OrderBy(session => session.TrainingDate)
            .Select(session => new
            {
                session.TrainingSessionId,
                session.TeamId,
                teamName = session.Team.TeamName,
                sport = session.Team.Sport.SportName,
                coachName = $"{session.Coach.User.FirstName} {session.Coach.User.LastName}",
                session.Title,
                session.Description,
                trainingDate = session.TrainingDate.ToString("yyyy-MM-dd"),
                session.StartTime,
                session.EndTime,
                session.Location,
                session.SubmittedAt
            })
            .ToListAsync();

        return Ok(sessions);
    }

    [HttpPut("sessions/{sessionId}/review")]
    [Authorize(Roles = "DIRECTOR")]
    public async Task<IActionResult> ReviewSession(int sessionId, [FromQuery] string status, TrainingApprovalRequest request)
    {
        var normalizedStatus = status.Trim().ToUpperInvariant();
        if (normalizedStatus is not ("APPROVED" or "REJECTED")) return BadRequest(new { message = "Status must be APPROVED or REJECTED." });

        var session = await _context.TrainingSessions
            .Include(item => item.Team).ThenInclude(team => team.TeamMembers).ThenInclude(member => member.Athlete)
            .FirstOrDefaultAsync(item => item.TrainingSessionId == sessionId);
        if (session == null) return NotFound(new { message = "Training session not found." });
        if (session.ApprovalStatus != "PENDING") return Conflict(new { message = "This training session has already been reviewed." });

        var reviewerId = GetUserId();
        await using var transaction = await _context.Database.BeginTransactionAsync();
        session.ApprovalStatus = normalizedStatus;
        session.ReviewedAt = DateTime.UtcNow;
        session.ReviewedBy = reviewerId;
        session.RejectionReason = normalizedStatus == "REJECTED" ? request.RejectionReason?.Trim() : null;

        if (normalizedStatus == "APPROVED")
        {
            var athleteUserIds = session.Team.TeamMembers.Where(member => member.DateLeft == null).Select(member => member.Athlete.UserId).Distinct().ToList();
            _context.Notifications.AddRange(athleteUserIds.Select(userId => new Notification
            {
                UserId = userId,
                Title = "Training session approved",
                Message = $"{session.Title} for {session.Team.TeamName} is scheduled on {session.TrainingDate:MMM d, yyyy}{(session.StartTime.HasValue ? $" at {session.StartTime:hh\\:mm}" : string.Empty)}{(string.IsNullOrWhiteSpace(session.Location) ? string.Empty : $" at {session.Location}")}.",
                NotificationType = "TRAINING_APPROVED",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            }));
        }
        else
        {
            var coachUserId = await _context.CoachProfiles.Where(coach => coach.CoachId == session.CoachId).Select(coach => coach.UserId).FirstAsync();
            _context.Notifications.Add(new Notification
            {
                UserId = coachUserId,
                Title = "Training session rejected",
                Message = $"{session.Title} for {session.Team.TeamName} was rejected.{(string.IsNullOrWhiteSpace(session.RejectionReason) ? string.Empty : $" Reason: {session.RejectionReason}")}",
                NotificationType = "TRAINING_REJECTED",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { session.TrainingSessionId, session.ApprovalStatus, session.ReviewedAt });
    }

    [HttpPost("sessions")]
    [Authorize(Roles = "COACH")]
    public async Task<IActionResult> CreateSession(TrainingSessionRequest request)
    {
        var coach = await GetCoachAsync();
        if (coach == null || !await _context.Teams.AnyAsync(team => team.TeamId == request.TeamId && team.CoachId == coach.CoachId)) return Forbid();
        if (request.EndTime.HasValue && request.StartTime.HasValue && request.EndTime <= request.StartTime) return BadRequest(new { message = "End time must be after start time." });
        var session = new TrainingSession { TeamId = request.TeamId, CoachId = coach.CoachId, Title = request.Title.Trim(), Description = request.Description, TrainingDate = request.TrainingDate.Date, StartTime = request.StartTime, EndTime = request.EndTime, Location = request.Location, ApprovalStatus = "PENDING", SubmittedAt = DateTime.UtcNow };
        _context.TrainingSessions.Add(session);
        await _context.SaveChangesAsync();
        var directorIds = await _context.Users.Where(user => user.Role.RoleName == "DIRECTOR").Select(user => user.UserId).ToListAsync();
        _context.Notifications.AddRange(directorIds.Select(userId => new Notification
        {
            UserId = userId,
            Title = "Training session approval requested",
            Message = $"{session.Title} for team {request.TeamId} is waiting for director approval.",
            NotificationType = "TRAINING_APPROVAL_REQUEST",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        }));
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetSessions), new { id = session.TrainingSessionId }, new { session.TrainingSessionId });
    }

    [HttpDelete("sessions/{sessionId}")]
    [Authorize(Roles = "ADMIN,DIRECTOR,COACH")]
    public async Task<IActionResult> DeleteSession(int sessionId)
    {
        var session = await _context.TrainingSessions
            .Include(item => item.Team)
            .FirstOrDefaultAsync(item => item.TrainingSessionId == sessionId);

        if (session == null) return NotFound(new { message = "Training session not found." });

        if (User.IsInRole("COACH"))
        {
            var coach = await GetCoachAsync();
            if (coach == null || session.Team.CoachId != coach.CoachId) return Forbid();
        }

        _context.TrainingSessions.Remove(session);
        await _context.SaveChangesAsync();
        return NoContent();
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

    private int? GetUserId() => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null;
}
