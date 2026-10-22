using AthleteHub.API.Data;
using AthleteHub.API.DTOs;
using AthleteHub.API.Models;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AthleteHub.API.Services;

namespace AthleteHub.API.Controllers;

/// <summary>
/// Grades pulled from the ICTD university database. Only the Sports Director can see them.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "DIRECTOR")]
public class AcademicRecordsController : ControllerBase
{
    private readonly AthleteHubDbContext _context;
    private readonly AthleteAccessService _access;

    public AcademicRecordsController(AthleteHubDbContext context, AthleteAccessService access)
    {
        _context = context;
        _access = access;
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
                sectionCode = a.SectionCode,
                units = a.Units,
                grade = a.Grade,
                remarks = a.Remarks,
                sourceType = a.SourceType,
                importedAt = a.ImportedAt
            })
            .ToListAsync();

        return Ok(new
        {
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
                record.sectionCode,
                record.units,
                record.grade,
                record.remarks,
                record.sourceType,
                record.importedAt
            })
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
                record.SectionCode,
                record.Units,
                record.Grade,
                record.Remarks,
                term = new { record.Term.AcademicYear, record.Term.Semester }
            })
        });
    }

    private Task<bool> CanViewAthleteAsync(int athleteId) => _access.CanViewAthleteAsync(User, athleteId);
}
