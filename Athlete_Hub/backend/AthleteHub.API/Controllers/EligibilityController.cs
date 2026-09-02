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
public class EligibilityController : ControllerBase
{
    private static readonly string[] ValidStatuses = ["ELIGIBLE", "AT_RISK", "INELIGIBLE", "PENDING"];
    private readonly AthleteHubDbContext _context;

    public EligibilityController(AthleteHubDbContext context) => _context = context;

    [HttpGet("athlete/{athleteId}")]
    public async Task<IActionResult> GetAthleteEligibility(int athleteId)
    {
        if (!await CanViewAthleteAsync(athleteId)) return Forbid();
        var records = await _context.EligibilityRecords.Include(record => record.Term).Where(record => record.AthleteId == athleteId).OrderByDescending(record => record.EvaluatedAt).Select(record => new { record.EligibilityId, record.AthleteId, record.AcademicStatus, record.Remarks, record.EvaluatedAt, term = new { record.Term.AcademicYear, record.Term.Semester } }).ToListAsync();
        return Ok(new { athleteId, recordCount = records.Count, records });
    }

    [HttpPost]
    [Authorize(Roles = "REGISTRAR,DIRECTOR,ADMIN")]
    public async Task<IActionResult> Create(EligibilityRecordRequest request)
    {
        if (!ValidStatuses.Contains(request.AcademicStatus.Trim().ToUpperInvariant())) return BadRequest(new { message = "Academic status must be ELIGIBLE, AT_RISK, INELIGIBLE, or PENDING." });
        if (!await _context.AthleteProfiles.AnyAsync(athlete => athlete.AthleteId == request.AthleteId)) return NotFound(new { message = "Athlete profile not found." });
        if (!await _context.AcademicTerms.AnyAsync(term => term.TermId == request.TermId)) return NotFound(new { message = "Academic term not found." });
        var record = new EligibilityRecord { AthleteId = request.AthleteId, TermId = request.TermId, AcademicStatus = request.AcademicStatus.Trim().ToUpperInvariant(), Remarks = request.Remarks, EvaluatedAt = DateTime.UtcNow };
        _context.EligibilityRecords.Add(record);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAthleteEligibility), new { athleteId = record.AthleteId }, new { record.EligibilityId, record.AthleteId, record.AcademicStatus });
    }

    private async Task<bool> CanViewAthleteAsync(int athleteId)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role is "ADMIN" or "DIRECTOR" or "REGISTRAR") return await _context.AthleteProfiles.AnyAsync(athlete => athlete.AthleteId == athleteId);
        if (role == "ATHLETE" && int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return await _context.AthleteProfiles.AnyAsync(athlete => athlete.AthleteId == athleteId && athlete.UserId == userId);
        if (role == "COACH" && int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var coachUserId)) return await _context.TeamMembers.AnyAsync(member => member.AthleteId == athleteId && member.Team.Coach != null && member.Team.Coach.UserId == coachUserId && member.DateLeft == null);
        return false;
    }
}
