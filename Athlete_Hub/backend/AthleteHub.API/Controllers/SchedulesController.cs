using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.DTOs;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
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
    private readonly NotificationService _notifications;
    private readonly AppClock _clock;

    public SchedulesController(AthleteHubDbContext context, NotificationService notifications, AppClock clock)
    {
        _context = context;
        _notifications = notifications;
        _clock = clock;
    }

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
            item.CreatedBy,
            cancelled = item.CancelledAt != null,
            item.CancellationReason,
            item.RescheduleReason,
            item.RescheduledAt
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
            .Where(session => (session.ApprovalStatus == "APPROVED" || session.ApprovalStatus == null || session.ApprovalStatus == "CANCELLED") && session.Team.TeamMembers.Any(member =>
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
                cancelled = session.ApprovalStatus == "CANCELLED",
                session.CancellationReason,
                session.RescheduleReason,
                session.RescheduledAt,
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
                cancelled = item.CancelledAt != null,
                item.CancellationReason,
                item.RescheduleReason,
                item.RescheduledAt,
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
            trainingQuery = trainingQuery.Where(session => session.ApprovalStatus == "APPROVED" || session.ApprovalStatus == null || session.ApprovalStatus == "CANCELLED");
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
                cancelled = session.ApprovalStatus == "CANCELLED",
                session.CancellationReason,
                session.RescheduleReason,
                session.RescheduledAt,
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
                cancelled = item.CancelledAt != null,
                item.CancellationReason,
                item.RescheduleReason,
                item.RescheduledAt,
                teamName = (string?)null
            })
            .ToListAsync();

        return Ok(trainingEvents.Cast<object>().Concat(sharedEvents));
    }

    // Sports events and competitions are published by the Sports Director; coaches schedule training instead.
    [HttpPost]
    [Authorize(Roles = "DIRECTOR")]
    public async Task<IActionResult> Create(ScheduleRequest request)
    {
        var type = request.ScheduleType.Trim().ToUpperInvariant();
        if (!ValidTypes.Contains(type)) return BadRequest(new { message = "Please choose what kind of event this is." });
        if (!request.StartDate.HasValue || !request.StartTime.HasValue) return BadRequest(new { message = "Please enter the start date and time." });
        if (request.EndDate.HasValue != request.EndTime.HasValue) return BadRequest(new { message = "Please enter both the end date and the end time, or leave both empty." });

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

        if (schedules.Any(schedule => schedule.EndDatetime.HasValue && schedule.EndDatetime <= schedule.StartDatetime)) return BadRequest(new { message = "The end must be later than the start." });
        _context.Schedules.AddRange(schedules);
        var label = type == "COMPETITION" ? "competition" : "sports event";
        var when = schedules.Count == 1
            ? $"on {schedules[0].StartDatetime:MMM d, yyyy 'at' h:mm tt}"
            : $"on {schedules.Count} dates starting {schedules[0].StartDatetime:MMM d, yyyy}";
        var recipients = (await _notifications.ActiveUserIdsInRoleAsync("ATHLETE")).Concat(await _notifications.ActiveUserIdsInRoleAsync("COACH"));
        _notifications.Notify(recipients, $"New {label}: {request.Title.Trim()}",
            $"{request.Title.Trim()} is scheduled {when}{(string.IsNullOrWhiteSpace(request.Location) ? string.Empty : $" at {request.Location.Trim()}")}.",
            "SCHEDULE_CREATED");
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = schedules[0].ScheduleId }, new { scheduleIds = schedules.Select(schedule => schedule.ScheduleId) });
    }

    /// <summary>
    /// Cancels a sports event or competition with a reason. It stays on calendars marked cancelled, and every
    /// athlete and coach is told why.
    /// </summary>
    [HttpPut("{scheduleId}/cancel")]
    [Authorize(Roles = "DIRECTOR")]
    public async Task<IActionResult> Cancel(int scheduleId, ScheduleChangeRequest request)
    {
        var (reason, reasonError) = request.CheckReason("cancellation");
        if (reasonError != null) return BadRequest(new { message = reasonError });
        var (schedule, problem) = await FindChangeableAsync(scheduleId);
        if (schedule == null) return problem!;

        schedule.CancelledAt = DateTime.UtcNow;
        schedule.CancellationReason = reason;
        _notifications.Notify(await EveryoneAsync(), $"{Label(schedule)} cancelled: {schedule.Title}",
            $"{schedule.Title} on {DescribeWhen(schedule)} has been cancelled. Reason: {reason}",
            "SCHEDULE_CANCELLED");
        await _context.SaveChangesAsync();
        return Ok(new { schedule.ScheduleId, schedule.CancelledAt });
    }

    /// <summary>Moves a sports event or competition to a new date or time, with a reason everyone is told.</summary>
    [HttpPut("{scheduleId}/reschedule")]
    [Authorize(Roles = "DIRECTOR")]
    public async Task<IActionResult> Reschedule(int scheduleId, ScheduleChangeRequest request)
    {
        var (reason, reasonError) = request.CheckReason("change");
        if (reasonError != null) return BadRequest(new { message = reasonError });
        if (!request.Date.HasValue || !request.StartTime.HasValue) return BadRequest(new { message = "Please choose the new date and start time." });
        if (request.EndTime.HasValue && request.EndTime <= request.StartTime) return BadRequest(new { message = "The end time must be later than the start time." });
        var start = request.Date.Value.Date.Add(request.StartTime.Value);
        if (request.Date.Value.Date < _clock.LocalToday) return BadRequest(new { message = "The new date cannot be in the past." });
        var (schedule, problem) = await FindChangeableAsync(scheduleId);
        if (schedule == null) return problem!;
        // An event that ended on a later day keeps the same number of days.
        var endDayOffset = schedule.EndDatetime.HasValue ? (schedule.EndDatetime.Value.Date - schedule.StartDatetime.Date).Days : 0;
        DateTime? end = request.EndTime.HasValue ? request.Date.Value.Date.AddDays(endDayOffset).Add(request.EndTime.Value) : null;
        if (schedule.StartDatetime == start && schedule.EndDatetime == end)
            return BadRequest(new { message = "Choose a different date or time to reschedule the event." });

        var before = DescribeWhen(schedule);
        schedule.StartDatetime = start;
        schedule.EndDatetime = end;
        schedule.RescheduleReason = reason;
        schedule.RescheduledAt = DateTime.UtcNow;
        _notifications.Notify(await EveryoneAsync(), $"{Label(schedule)} rescheduled: {schedule.Title}",
            $"{schedule.Title} moved from {before} to {DescribeWhen(schedule)}. Reason: {reason}",
            "SCHEDULE_RESCHEDULED");
        await _context.SaveChangesAsync();
        return Ok(new { schedule.ScheduleId, schedule.StartDatetime, schedule.EndDatetime });
    }

    private async Task<(Schedule? Schedule, IActionResult? Problem)> FindChangeableAsync(int scheduleId)
    {
        var schedule = await _context.Schedules.FirstOrDefaultAsync(item => item.ScheduleId == scheduleId && ValidTypes.Contains(item.ScheduleType));
        if (schedule == null) return (null, NotFound(new { message = "We could not find this event. It may have been deleted." }));
        if (schedule.CancelledAt != null) return (null, Conflict(new { message = "This event is already cancelled." }));
        if (schedule.StartDatetime.Date < _clock.LocalToday) return (null, BadRequest(new { message = "This event has already taken place, so it cannot be changed." }));
        return (schedule, null);
    }

    // Sports events and competitions are for everyone, so changes go to every active athlete and coach.
    private async Task<IEnumerable<int>> EveryoneAsync() =>
        (await _notifications.ActiveUserIdsInRoleAsync("ATHLETE")).Concat(await _notifications.ActiveUserIdsInRoleAsync("COACH"));

    private static string Label(Schedule schedule) => schedule.ScheduleType == "COMPETITION" ? "Competition" : "Sports event";

    private static string DescribeWhen(Schedule schedule) =>
        $"{schedule.StartDatetime:MMM d, yyyy 'at' h:mm tt}{(string.IsNullOrWhiteSpace(schedule.Location) ? string.Empty : $", {schedule.Location}")}";

    [HttpDelete("{scheduleId}")]
    [Authorize(Roles = "DIRECTOR")]
    public async Task<IActionResult> Delete(int scheduleId)
    {
        var schedule = await _context.Schedules.FindAsync(scheduleId);
        if (schedule == null) return NotFound();
        _context.Schedules.Remove(schedule);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private int? GetUserId() => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null;
}
