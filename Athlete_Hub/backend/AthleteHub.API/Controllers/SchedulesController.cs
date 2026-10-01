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
public class SchedulesController : ControllerBase
{
    private static readonly string[] ValidTypes = ["COMPETITION", "SPORTS_EVENT"];
    private readonly AthleteHubDbContext _context;

    public SchedulesController(AthleteHubDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> Get(DateTime? from = null, DateTime? to = null)
    {
        var query = _context.Schedules.Where(item => ValidTypes.Contains(item.ScheduleType));
        if (from.HasValue) query = query.Where(item => item.StartDatetime >= from.Value);
        if (to.HasValue) query = query.Where(item => item.StartDatetime < to.Value.Date.AddDays(1));
        var schedules = await query
            .OrderBy(item => item.StartDatetime)
            .ToListAsync();

        return Ok(schedules.Select(item => new
        {
            item.ScheduleId,
            item.Title,
            item.Description,
            item.ScheduleType,
            startDate = item.StartDatetime.ToString("yyyy-MM-dd"),
            startTime = item.StartDatetime.ToString("HH:mm:ss"),
            endDate = item.EndDatetime.HasValue ? item.EndDatetime.Value.ToString("yyyy-MM-dd") : null,
            endTime = item.EndDatetime.HasValue ? item.EndDatetime.Value.ToString("HH:mm:ss") : null,
            item.Location,
            item.CreatedBy
        }));
    }

    [HttpGet("athlete")]
    [Authorize(Roles = "ATHLETE,STUDENT")]
    public async Task<IActionResult> GetAthleteCalendar(DateTime? from = null, DateTime? to = null)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return Unauthorized();
        }

        var trainingQuery = _context.TrainingSessions
            .Include(session => session.Team)
            .Where(session => (session.ApprovalStatus == "APPROVED" || session.ApprovalStatus == null) && session.Team.TeamMembers.Any(member =>
                member.Athlete.UserId == userId && member.DateLeft == null));

        if (from.HasValue) trainingQuery = trainingQuery.Where(session => session.TrainingDate >= from.Value.Date);
        if (to.HasValue) trainingQuery = trainingQuery.Where(session => session.TrainingDate <= to.Value.Date);

        var trainingEvents = await trainingQuery
            .Select(session => new
            {
                id = $"training-{session.TrainingSessionId}",
                sourceId = session.TrainingSessionId,
                type = "TRAINING",
                session.Title,
                session.Description,
                startDate = session.TrainingDate.ToString("yyyy-MM-dd"),
                startTime = session.StartTime.HasValue ? session.StartTime.Value.ToString() : null,
                endDate = session.TrainingDate.ToString("yyyy-MM-dd"),
                endTime = session.EndTime.HasValue ? session.EndTime.Value.ToString() : null,
                session.Location,
                teamName = session.Team.TeamName
            })
            .ToListAsync();

        var scheduleQuery = _context.Schedules.Where(item => ValidTypes.Contains(item.ScheduleType));
        if (from.HasValue) scheduleQuery = scheduleQuery.Where(item => item.StartDatetime >= from.Value);
        if (to.HasValue) scheduleQuery = scheduleQuery.Where(item => item.StartDatetime < to.Value.Date.AddDays(1));

        var sharedEvents = await scheduleQuery
            .OrderBy(item => item.StartDatetime)
            .Select(item => new
            {
                id = $"schedule-{item.ScheduleId}",
                sourceId = item.ScheduleId,
                type = item.ScheduleType,
                item.Title,
                item.Description,
                startDate = item.StartDatetime.ToString("yyyy-MM-dd"),
                startTime = item.StartDatetime.ToString("HH:mm:ss"),
                endDate = item.EndDatetime.HasValue ? item.EndDatetime.Value.ToString("yyyy-MM-dd") : null,
                endTime = item.EndDatetime.HasValue ? item.EndDatetime.Value.ToString("HH:mm:ss") : null,
                item.Location,
                teamName = (string?)null
            })
            .ToListAsync();

        return Ok(trainingEvents.Cast<object>().Concat(sharedEvents));
    }

    [HttpGet("staff")]
    [Authorize(Roles = "COACH,DIRECTOR")]
    public async Task<IActionResult> GetStaffCalendar(DateTime? from = null, DateTime? to = null)
    {
        var trainingQuery = _context.TrainingSessions
            .Include(session => session.Team)
            .AsQueryable();

        if (User.IsInRole("COACH"))
        {
            var coach = await _context.CoachProfiles.FirstOrDefaultAsync(item => item.UserId == GetUserId());
            if (coach == null) return Forbid();
            trainingQuery = trainingQuery.Where(session => session.Team.CoachId == coach.CoachId || session.CoachId == coach.CoachId);
        }
        else
        {
            trainingQuery = trainingQuery.Where(session => session.ApprovalStatus == "APPROVED" || session.ApprovalStatus == null);
        }

        if (from.HasValue) trainingQuery = trainingQuery.Where(session => session.TrainingDate >= from.Value.Date);
        if (to.HasValue) trainingQuery = trainingQuery.Where(session => session.TrainingDate <= to.Value.Date);

        var trainingEvents = await trainingQuery
            .Select(session => new
            {
                id = $"training-{session.TrainingSessionId}",
                sourceId = session.TrainingSessionId,
                type = "TRAINING",
                session.Title,
                session.Description,
                startDate = session.TrainingDate.ToString("yyyy-MM-dd"),
                startTime = session.StartTime.HasValue ? session.StartTime.Value.ToString() : null,
                endDate = session.TrainingDate.ToString("yyyy-MM-dd"),
                endTime = session.EndTime.HasValue ? session.EndTime.Value.ToString() : null,
                session.Location,
                session.ApprovalStatus,
                session.RejectionReason,
                teamName = session.Team.TeamName
            })
            .ToListAsync();

        var sharedQuery = _context.Schedules.Where(item => ValidTypes.Contains(item.ScheduleType));
        if (from.HasValue) sharedQuery = sharedQuery.Where(item => item.StartDatetime >= from.Value);
        if (to.HasValue) sharedQuery = sharedQuery.Where(item => item.StartDatetime < to.Value.Date.AddDays(1));

        var sharedEvents = await sharedQuery
            .Select(item => new
            {
                id = $"schedule-{item.ScheduleId}",
                sourceId = item.ScheduleId,
                type = item.ScheduleType,
                item.Title,
                item.Description,
                startDate = item.StartDatetime.ToString("yyyy-MM-dd"),
                startTime = item.StartDatetime.ToString("HH:mm:ss"),
                endDate = item.EndDatetime.HasValue ? item.EndDatetime.Value.ToString("yyyy-MM-dd") : null,
                endTime = item.EndDatetime.HasValue ? item.EndDatetime.Value.ToString("HH:mm:ss") : null,
                item.Location,
                teamName = (string?)null
            })
            .ToListAsync();

        return Ok(trainingEvents.Cast<object>().Concat(sharedEvents));
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN,DIRECTOR,COACH,REGISTRAR")]
    public async Task<IActionResult> Create(ScheduleRequest request)
    {
        var type = request.ScheduleType.Trim().ToUpperInvariant();
        if (!ValidTypes.Contains(type)) return BadRequest(new { message = "Invalid schedule type." });
        if (User.IsInRole("DIRECTOR") && type is not ("SPORTS_EVENT" or "COMPETITION"))
        {
            return BadRequest(new { message = "Directors may only create sports events or competitions." });
        }
        if (!request.StartDate.HasValue || !request.StartTime.HasValue) return BadRequest(new { message = "Start date and start time are required." });
        if (request.EndDate.HasValue != request.EndTime.HasValue) return BadRequest(new { message = "End date and end time must be provided together." });

        var dates = (request.Dates is { Count: > 0 } ? request.Dates : [request.StartDate.Value])
            .Select(date => date.Date)
            .Distinct()
            .OrderBy(date => date)
            .ToList();

        var schedules = dates.Select(date =>
        {
            var startDatetime = date.Add(request.StartTime!.Value);
            var endDatetime = request.EndTime.HasValue ? date.Add(request.EndTime.Value) : (DateTime?)null;
            return new Schedule { Title = request.Title.Trim(), Description = request.Description, ScheduleType = type, StartDatetime = startDatetime, EndDatetime = endDatetime, Location = request.Location, CreatedBy = GetUserId() };
        }).ToList();

        if (schedules.Any(schedule => schedule.EndDatetime.HasValue && schedule.EndDatetime <= schedule.StartDatetime)) return BadRequest(new { message = "End date and time must be after start date and time." });
        _context.Schedules.AddRange(schedules);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = schedules[0].ScheduleId }, new { scheduleIds = schedules.Select(schedule => schedule.ScheduleId) });
    }

    [HttpDelete("{scheduleId}")]
    [Authorize(Roles = "ADMIN,DIRECTOR,COACH,REGISTRAR")]
    public async Task<IActionResult> Delete(int scheduleId)
    {
        var schedule = await _context.Schedules.FindAsync(scheduleId);
        if (schedule == null) return NotFound();
        if (!User.IsInRole("ADMIN") && schedule.CreatedBy != GetUserId()) return Forbid();
        _context.Schedules.Remove(schedule);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private int? GetUserId() => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null;
}
