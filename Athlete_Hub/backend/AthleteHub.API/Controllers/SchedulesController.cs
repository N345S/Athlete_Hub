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
    private static readonly string[] ValidTypes = ["TRAINING", "COMPETITION", "ACADEMIC", "MEETING", "OTHER"];
    private readonly AthleteHubDbContext _context;

    public SchedulesController(AthleteHubDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> Get(DateTime? from = null, DateTime? to = null)
    {
        var query = _context.Schedules.AsQueryable();
        if (from.HasValue) query = query.Where(item => item.StartDatetime >= from.Value);
        if (to.HasValue) query = query.Where(item => item.StartDatetime <= to.Value);
        return Ok(await query.OrderBy(item => item.StartDatetime).Select(item => new { item.ScheduleId, item.Title, item.Description, item.ScheduleType, item.StartDatetime, item.EndDatetime, item.Location, item.CreatedBy }).ToListAsync());
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN,DIRECTOR,COACH,REGISTRAR")]
    public async Task<IActionResult> Create(ScheduleRequest request)
    {
        var type = request.ScheduleType.Trim().ToUpperInvariant();
        if (!ValidTypes.Contains(type)) return BadRequest(new { message = "Invalid schedule type." });
        if (request.EndDatetime.HasValue && request.EndDatetime <= request.StartDatetime) return BadRequest(new { message = "End datetime must be after start datetime." });
        var schedule = new Schedule { Title = request.Title.Trim(), Description = request.Description, ScheduleType = type, StartDatetime = request.StartDatetime, EndDatetime = request.EndDatetime, Location = request.Location, CreatedBy = GetUserId() };
        _context.Schedules.Add(schedule);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = schedule.ScheduleId }, new { schedule.ScheduleId });
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
