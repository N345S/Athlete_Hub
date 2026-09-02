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
public class PerformanceController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public PerformanceController(AthleteHubDbContext context) => _context = context;

    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics() => Ok(await _context.PerformanceMetricDefinitions
        .Include(metric => metric.Sport)
        .OrderBy(metric => metric.Sport.SportName).ThenBy(metric => metric.MetricName)
        .Select(metric => new { metric.MetricId, metric.MetricName, metric.Description, metric.Unit, sport = metric.Sport.SportName })
        .ToListAsync());

    [HttpGet("athlete/{athleteId}")]
    public async Task<IActionResult> GetAthletePerformance(int athleteId)
    {
        if (!await CanViewAthleteAsync(athleteId)) return Forbid();
        var records = await _context.PerformanceRecords
            .Include(record => record.Metric).ThenInclude(metric => metric.Sport)
            .Where(record => record.AthleteId == athleteId)
            .OrderByDescending(record => record.RecordedDate)
            .Select(record => new { record.PerformanceRecordId, record.AthleteId, record.RecordedValue, record.RecordedDate, record.Notes, metric = new { record.Metric.MetricId, record.Metric.MetricName, record.Metric.Unit, sport = record.Metric.Sport.SportName } })
            .ToListAsync();
        return Ok(new { athleteId, recordCount = records.Count, records });
    }

    [HttpPost("records")]
    [Authorize(Roles = "COACH")]
    public async Task<IActionResult> CreateRecord(PerformanceRecordRequest request)
    {
        var coach = await GetCoachAsync();
        if (coach == null || !await CoachHasAthleteAsync(coach.CoachId, request.AthleteId)) return Forbid();
        if (!await _context.PerformanceMetricDefinitions.AnyAsync(metric => metric.MetricId == request.MetricId)) return NotFound(new { message = "Performance metric not found." });
        var record = new PerformanceRecord { AthleteId = request.AthleteId, MetricId = request.MetricId, RecordedValue = request.RecordedValue, RecordedDate = request.RecordedDate.Date, CoachId = coach.CoachId, Notes = request.Notes };
        _context.PerformanceRecords.Add(record);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAthletePerformance), new { athleteId = record.AthleteId }, new { record.PerformanceRecordId, record.AthleteId });
    }

    private async Task<CoachProfile?> GetCoachAsync()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return null;
        return await _context.CoachProfiles.FirstOrDefaultAsync(coach => coach.UserId == userId);
    }

    private async Task<bool> CoachHasAthleteAsync(int coachId, int athleteId) => await _context.TeamMembers.AnyAsync(member => member.AthleteId == athleteId && member.Team.CoachId == coachId && member.DateLeft == null);

    private async Task<bool> CanViewAthleteAsync(int athleteId)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role is "ADMIN" or "DIRECTOR" or "REGISTRAR") return await _context.AthleteProfiles.AnyAsync(athlete => athlete.AthleteId == athleteId);
        if (role == "ATHLETE" && int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return await _context.AthleteProfiles.AnyAsync(athlete => athlete.AthleteId == athleteId && athlete.UserId == userId);
        var coach = await GetCoachAsync();
        return coach != null && await CoachHasAthleteAsync(coach.CoachId, athleteId);
    }
}
