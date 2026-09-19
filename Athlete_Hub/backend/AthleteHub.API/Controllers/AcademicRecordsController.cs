using AthleteHub.API.Data;
using AthleteHub.API.DTOs;
using AthleteHub.API.Models;
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
                    semester = a.Term.Semester
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
            records = records.Select(record => new
            {
                record.academicRecordId,
                record.athleteId,
                term = new
                {
                    record.term.termId,
                    record.term.academicYear,
                    record.term.semester
                },
                record.subjectCode,
                record.subjectName,
                record.units,
                record.grade,
                record.remarks,
                record.sourceType,
                record.importedAt
            })
        });
    }

    [HttpPut("{academicRecordId}")]
    [Authorize(Roles = "REGISTRAR")]
    public async Task<IActionResult> UpdateAcademicRecord(
        int academicRecordId,
        UpdateAcademicRecordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.AcademicYear)
            || string.IsNullOrWhiteSpace(request.Semester)
            || string.IsNullOrWhiteSpace(request.SubjectCode)
            || string.IsNullOrWhiteSpace(request.SubjectName))
        {
            return BadRequest(new { message = "Academic year, semester, subject code, and subject name are required." });
        }

        if (request.Grade is < 0 or > 100)
        {
            return BadRequest(new { message = "Grades must be between 0 and 100." });
        }

        var record = await _context.AcademicRecords
            .Include(item => item.Term)
            .FirstOrDefaultAsync(item => item.AcademicRecordId == academicRecordId);

        if (record == null)
        {
            return NotFound(new { message = "Academic record not found." });
        }

        var term = await _context.AcademicTerms.FirstOrDefaultAsync(currentTerm =>
            currentTerm.AcademicYear == request.AcademicYear.Trim()
            && currentTerm.Semester == request.Semester.Trim());

        if (term == null)
        {
            term = new AcademicTerm
            {
                AcademicYear = request.AcademicYear.Trim(),
                Semester = request.Semester.Trim()
            };
            _context.AcademicTerms.Add(term);
            await _context.SaveChangesAsync();
        }

        record.TermId = term.TermId;
        record.SubjectCode = request.SubjectCode.Trim();
        record.SubjectName = request.SubjectName.Trim();
        record.Units = request.Units;
        record.Grade = request.Grade;
        record.Remarks = string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim();
        record.SourceType = "API";
        record.ImportedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Academic record updated successfully.", academicRecordId = record.AcademicRecordId });
    }

    [HttpDelete("{academicRecordId}")]
    [Authorize(Roles = "ADMIN,DIRECTOR,REGISTRAR")]
    public async Task<IActionResult> DeleteAcademicRecord(int academicRecordId)
    {
        var record = await _context.AcademicRecords.FindAsync(academicRecordId);
        if (record == null) return NotFound(new { message = "Academic record not found." });

        _context.AcademicRecords.Remove(record);
        await _context.SaveChangesAsync();
        return NoContent();
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