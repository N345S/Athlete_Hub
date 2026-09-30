using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.DTOs;
using AthleteHub.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

/// <summary>
/// Controller for managing performance metrics and athlete performance records.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PerformanceController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    /// <summary>
    /// Initializes a new instance of the <see cref="PerformanceController"/> class.
    /// </summary>
    /// <param name="context">The database context.</param>
    public PerformanceController(AthleteHubDbContext context) => _context = context;

    /// <summary>
    /// Gets all performance metric definitions grouped by sport.
    /// </summary>
    /// <returns>List of performance metrics with sport associations.</returns>
    /// <response code="200">Returns the list of performance metrics.</response>
    /// <response code="401">Invalid or missing JWT token.</response>
    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics() => Ok(await _context.PerformanceMetricDefinitions
        .Include(metric => metric.Sport)
        .OrderBy(metric => metric.Sport.SportName).ThenBy(metric => metric.MetricName)
        .Select(metric => new { metric.MetricId, metric.MetricName, metric.Description, metric.Unit, metric.DataType, sport = metric.Sport.SportName })
        .ToListAsync());

    /// <summary>
    /// Gets available performance data types for the universal metric.
    /// </summary>
    /// <returns>List of unique data types that coaches can use for tracking.</returns>
    /// <response code="200">Returns the list of available data types.</response>
    /// <response code="401">Invalid or missing JWT token.</response>
    [HttpGet("data-types")]
    public async Task<IActionResult> GetDataTypes() => Ok(await _context.PerformanceMetricDefinitions
        .Where(m => !string.IsNullOrEmpty(m.DataType))
        .Select(m => new { m.DataType, m.Unit, m.MetricName })
        .Distinct()
        .ToListAsync());

    /// <summary>
    /// Gets performance records for a specific athlete.
    /// </summary>
    /// <param name="athleteId">The ID of the athlete to retrieve records for.</param>
    /// <returns>Performance records with metric details, ordered by date (newest first).</returns>
    /// <response code="200">Returns the athlete's performance records.</response>
    /// <response code="401">Invalid or missing JWT token.</response>
    /// <response code="403">User not authorized to view this athlete's records.</response>
    [HttpGet("athlete/{athleteId}")]
    public async Task<IActionResult> GetAthletePerformance(int athleteId)
    {
        if (!await CanViewAthleteAsync(athleteId)) return Forbid();
        var records = await _context.PerformanceRecords
            .Include(record => record.Metric).ThenInclude(metric => metric.Sport)
            .Where(record => record.AthleteId == athleteId)
            .OrderByDescending(record => record.RecordedDate)
            .Select(record => new { record.PerformanceRecordId, record.AthleteId, record.RecordedValue, record.RecordedDate, record.Notes, record.DataType, record.Unit, metric = new { record.Metric.MetricId, record.Metric.MetricName, record.Metric.Unit, sport = record.Metric.Sport.SportName } })
            .ToListAsync();
        return Ok(new
        {
            athleteId,
            recordCount = records.Count,
            records = records.Select(record => new
            {
                record.PerformanceRecordId,
                record.AthleteId,
                record.RecordedValue,
                recordedDate = record.RecordedDate.ToString("yyyy-MM-dd"),
                record.Notes,
                record.DataType,
                record.Unit,
                metric = record.metric
            })
        });
    }

    /// <summary>
    /// Creates a new performance record for an athlete (coach only).
    /// </summary>
    /// <param name="request">The performance record details including metric, value, date, notes, data type, and session.</param>
    /// <returns>Created performance record ID.</returns>
    /// <response code="201">Performance record created successfully.</response>
    /// <response code="400">Invalid metric or missing required fields.</response>
    /// <response code="401">Invalid or missing JWT token.</response>
    /// <response code="403">User is not a coach or not assigned to this athlete.</response>
    /// <response code="404">Performance metric not found or session not found.</response>
    [HttpPost("record")]
    [Authorize(Roles = "COACH")]
    public async Task<IActionResult> CreateRecord(PerformanceRecordRequest request)
    {
        var coach = await GetCoachAsync();
        if (coach == null || !await CoachHasAthleteAsync(coach.CoachId, request.AthleteId)) return Forbid();
        if (string.IsNullOrWhiteSpace(request.DataType)) return BadRequest(new { message = "A universal performance name is required." });

        var metricId = request.MetricId > 0
            ? request.MetricId
            : await _context.PerformanceMetricDefinitions.Select(metric => (int?)metric.MetricId).FirstOrDefaultAsync();
        if (!metricId.HasValue) return NotFound(new { message = "No performance metric definition is available." });
        if (!await _context.PerformanceMetricDefinitions.AnyAsync(metric => metric.MetricId == metricId.Value)) return NotFound(new { message = "Performance metric not found." });

        if (request.SessionId <= 0)
        {
            return BadRequest(new { message = "Select a completed training session before recording performance." });
        }

        var session = await _context.TrainingSessions
            .Include(item => item.Team)
            .FirstOrDefaultAsync(item => item.TrainingSessionId == request.SessionId);
        if (session == null) return NotFound(new { message = "Training session not found." });
        if (session.CoachId != coach.CoachId) return Forbid();
        if (session.ApprovalStatus != "APPROVED")
        {
            return BadRequest(new { message = "Performance can only be recorded for a director-approved training session." });
        }

        if (!await _context.TeamMembers.AnyAsync(member =>
                member.TeamId == session.TeamId
                && member.AthleteId == request.AthleteId
                && member.DateLeft == null))
        {
            return BadRequest(new { message = "The selected athlete is not assigned to this training session's team." });
        }

        var sessionEnd = session.TrainingDate.Date.AddDays(1).AddTicks(-1);
        if (session.EndTime.HasValue)
        {
            sessionEnd = session.TrainingDate.Date.Add(session.EndTime.Value);
        }

        if (DateTime.UtcNow < sessionEnd)
        {
            return BadRequest(new { message = "Performance can only be recorded after the training session has ended." });
        }

        if (request.RecordedDate.Date < session.TrainingDate.Date || request.RecordedDate.Date > DateTime.UtcNow.Date)
        {
            return BadRequest(new { message = "The performance date must be between the training session date and today." });
        }

        var record = new PerformanceRecord 
        { 
            AthleteId = request.AthleteId, 
            MetricId = metricId.Value, 
            RecordedValue = request.RecordedValue, 
            RecordedDate = request.RecordedDate.Date, 
            CoachId = coach.CoachId, 
            Notes = request.Notes,
            DataType = request.DataType,
            Unit = request.Unit,
            SessionId = request.SessionId > 0 ? request.SessionId : null
        };
        
        _context.PerformanceRecords.Add(record);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAthletePerformance), new { athleteId = record.AthleteId }, new { record.PerformanceRecordId, record.AthleteId });
    }

    /// <summary>
    /// Gets performance trend data for an athlete for line chart visualization.
    /// </summary>
    /// <param name="athleteId">The ID of the athlete.</param>
    /// <param name="timeRange">Time range filter: 'overall', 'monthly', 'weekly'.</param>
    /// <returns>Performance trend data grouped by session for line chart.</returns>
    /// <response code="200">Returns trend data with labels and datasets.</response>
    /// <response code="401">Invalid or missing JWT token.</response>
    /// <response code="403">User not authorized to view this athlete's records.</response>
    [HttpGet("athlete/{athleteId}/trend")]
    [Authorize(Roles = "COACH,DIRECTOR,ADMIN,ATHLETE,STUDENT")]
    public async Task<IActionResult> GetAthleteTrend(int athleteId, string timeRange = "overall")
    {
        if (!await CanViewAthleteAsync(athleteId)) return Forbid();

        var query = _context.PerformanceRecords
            .Where(r => r.AthleteId == athleteId)
            .Include(r => r.Session)
            .AsQueryable();

        // Apply time range filter
        var now = DateTime.UtcNow;
        switch (timeRange.ToLower())
        {
            case "weekly":
                query = query.Where(r => r.RecordedDate >= now.AddDays(-7));
                break;
            case "monthly":
                query = query.Where(r => r.RecordedDate >= now.AddDays(-30));
                break;
            case "overall":
            default:
                // No date filter
                break;
        }

        var records = await query
            .OrderBy(r => r.RecordedDate)
            .Select(r => new 
            { 
                r.RecordedValue, 
                r.RecordedDate, 
                r.DataType,
                r.Unit,
                SessionTitle = r.Session != null ? r.Session.Title : "Session " + r.SessionId,
                r.SessionId
            })
            .ToListAsync();

        // Group by DataType to create datasets
        var dataTypes = records.Select(r => r.DataType).Distinct().Where(dt => !string.IsNullOrEmpty(dt)).ToList();
        
        var datasets = new List<object>();
        
        // Get all unique sessions/dates for labels (group by session)
        var allSessions = records
            .Where(r => r.SessionId.HasValue)
            .GroupBy(r => r.SessionId)
            .OrderBy(g => g.First().RecordedDate)
            .Select(g => new 
            { 
                SessionId = g.Key,
                Label = g.First().SessionTitle,
                Date = g.First().RecordedDate
            })
            .ToList();

        // Generate labels from session titles
        var labels = allSessions.Any() 
            ? allSessions.Select(s => s.Label).ToList()
            : records
                .Select(r => r.RecordedDate.ToString("MMM dd"))
                .Distinct()
                .ToList();

        foreach (var dataType in dataTypes)
        {
            var typeRecords = records.Where(r => r.DataType == dataType).ToList();
            var data = new List<decimal?>();
            
            // Map values to session order
            if (allSessions.Any())
            {
                foreach (var session in allSessions)
                {
                    var sessionRecord = typeRecords.FirstOrDefault(r => r.SessionId == session.SessionId);
                    data.Add(sessionRecord?.RecordedValue);
                }
            }
            else
            {
                // If no sessions found, use date-based data
                data = typeRecords.OrderBy(r => r.RecordedDate).Select(r => (decimal?)r.RecordedValue).ToList();
            }

            datasets.Add(new
            {
                label = FormatDataTypeLabel(dataType) + (records.FirstOrDefault(record => record.DataType == dataType)?.Unit is { Length: > 0 } unit ? $" ({unit.ToLowerInvariant()})" : string.Empty),
                data = data,
                borderColor = GetColorForDataType(dataType),
                tension = 0.1,
                fill = false
            });
        }

        return Ok(new
        {
            labels,
            datasets
        });
    }

    private string FormatDataTypeLabel(string? dataType)
    {
        return dataType switch
        {
            "PUSH_UP" => "Push-ups",
            "BALANCE" => "Balance (seconds)",
            "SPRINT_10M" => "Sprint 10m (seconds)",
            "SPRINT_40M" => "Sprint 40m (seconds)",
            "VELOCITY" => "Velocity",
            _ => dataType?.Replace("_", " ") ?? "Performance"
        };
    }

    private string GetColorForDataType(string? dataType)
    {
        return dataType switch
        {
            "PUSH_UP" => "rgb(255, 99, 132)",
            "BALANCE" => "rgb(54, 162, 235)",
            "SPRINT_10M" => "rgb(255, 206, 86)",
            "SPRINT_40M" => "rgb(75, 192, 192)",
            "VELOCITY" => "rgb(153, 102, 255)",
            _ => "rgb(201, 203, 207)"
        };
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
