using AthleteHub.API.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AcademicRecordsController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public AcademicRecordsController(AthleteHubDbContext context)
    {
        _context = context;
    }

    // ==========================================
    // GET ACADEMIC RECORDS FOR AN ATHLETE
    // GET: /api/AcademicRecords/athlete/{athleteId}
    // ==========================================

    [HttpGet("athlete/{athleteId}")]
    public async Task<IActionResult> GetAthleteAcademicRecords(int athleteId)
    {
        if (!await CanViewAthleteAsync(athleteId))
        {
            return Forbid();
        }

        var records = await _context.AcademicRecords
            .Include(a => a.Term)
            .Where(a => a.AthleteId == athleteId)
            .OrderByDescending(a => a.Term.AcademicYear)
            .ThenBy(a => a.Term.Semester)
            .ThenBy(a => a.SubjectCode)
            .Select(a => new
            {
                academicRecordId = a.AcademicRecordId,
                athleteId = a.AthleteId,

                term = new
                {
                    termId = a.Term.TermId,
                    academicYear = a.Term.AcademicYear,
                    semester = a.Term.Semester,
                    startDate = a.Term.StartDate,
                    endDate = a.Term.EndDate
                },

                subjectCode = a.SubjectCode,
                subjectName = a.SubjectName,
                units = a.Units,
                grade = a.Grade,
                remarks = a.Remarks,
                sourceType = a.SourceType,
                importedAt = a.ImportedAt
            })
            .ToListAsync();

        if (records.Count == 0)
        {
            return NotFound(new
            {
                message = "No academic records found for this athlete.",
                athleteId = athleteId
            });
        }

        return Ok(new
        {
            endpoint = $"GET /api/AcademicRecords/athlete/{athleteId}",
            access = "GRANTED",
            athleteId = athleteId,
            recordCount = records.Count,
            records
        });
    }

    [HttpGet("dashboard/{athleteId}")]
    public async Task<IActionResult> GetAcademicDashboard(int athleteId)
    {
        if (!await CanViewAthleteAsync(athleteId))
        {
            return Forbid();
        }

        var records = await _context.AcademicRecords
            .Include(record => record.Term)
            .Where(record => record.AthleteId == athleteId)
            .OrderByDescending(record => record.Term.AcademicYear)
            .ThenByDescending(record => record.Term.Semester)
            .ThenBy(record => record.SubjectCode)
            .ToListAsync();

        var eligibility = await _context.EligibilityRecords
            .Include(record => record.Term)
            .Where(record => record.AthleteId == athleteId)
            .OrderByDescending(record => record.EvaluatedAt)
            .Select(record => new
            {
                record.EligibilityId,
                record.AcademicStatus,
                record.Remarks,
                record.EvaluatedAt,
                term = new
                {
                    record.Term.AcademicYear,
                    record.Term.Semester
                }
            })
            .FirstOrDefaultAsync();

        return Ok(new
        {
            athleteId,
            recordCount = records.Count,
            totalUnits = records.Sum(record => record.Units ?? 0),
            averageGrade = records.Count == 0
                ? (decimal?)null
                : Math.Round(records.Where(record => record.Grade.HasValue)
                    .Select(record => record.Grade!.Value)
                    .DefaultIfEmpty()
                    .Average(), 2),
            latestTerm = records.FirstOrDefault() is { } latest
                ? new { latest.Term.AcademicYear, latest.Term.Semester }
                : null,
            latestEligibility = eligibility,
            records = records.Select(record => new
            {
                record.AcademicRecordId,
                record.SubjectCode,
                record.SubjectName,
                record.Units,
                record.Grade,
                record.Remarks,
                term = new { record.Term.AcademicYear, record.Term.Semester }
            })
        });
    }

    private async Task<bool> CanViewAthleteAsync(int athleteId)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role is "ADMIN" or "DIRECTOR" or "REGISTRAR")
        {
            return await _context.AthleteProfiles.AnyAsync(athlete => athlete.AthleteId == athleteId);
        }

        if (role == "ATHLETE")
        {
            return int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)
                && await _context.AthleteProfiles.AnyAsync(athlete =>
                    athlete.AthleteId == athleteId && athlete.UserId == userId);
        }

        if (role == "COACH"
            && int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var coachUserId))
        {
            return await _context.TeamMembers
                .AnyAsync(member => member.AthleteId == athleteId
                    && member.Team.Coach != null
                    && member.Team.Coach.UserId == coachUserId
                    && member.DateLeft == null);
        }

        return false;
    }
}