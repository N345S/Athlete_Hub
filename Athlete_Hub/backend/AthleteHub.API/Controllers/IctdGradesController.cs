using AthleteHub.API.Data;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

/// <summary>
/// Final grades from the ICTD university database, pulled automatically by <see cref="IctdGradeSyncWorker"/> once
/// ICTD releases them. Only the Sports Director can see them, after re-entering their password (see
/// <see cref="SensitiveAccess"/>).
/// </summary>
[ApiController]
[Route("api/IctdGrades")]
[Authorize(Roles = "DIRECTOR", Policy = SensitiveAccess.Policy)]
public class IctdGradesController : ControllerBase
{
    private const string IctdSource = IctdGradeSync.IctdSource;

    private readonly AthleteHubDbContext _context;

    public IctdGradesController(AthleteHubDbContext context)
    {
        _context = context;
    }

    /// <summary>Every term with pulled grades, newest first, with failed and INC counts and evaluation progress.</summary>
    [HttpGet("terms")]
    public async Task<IActionResult> GetTerms()
    {
        var terms = await _context.AcademicRecords
            .Where(record => record.SourceType == IctdSource)
            .GroupBy(record => new { record.TermId, record.Term.AcademicYear, record.Term.Semester })
            .Select(group => new
            {
                group.Key.TermId,
                group.Key.AcademicYear,
                group.Key.Semester,
                athletes = group.Select(record => record.AthleteId).Distinct().Count(),
                subjects = group.Count(),
                failed = group.Count(record => record.Remarks == "FAILED"),
                incomplete = group.Count(record => record.Remarks == "INC"),
                lastPulledAt = group.Max(record => record.ImportedAt)
            })
            .ToListAsync();

        var termIds = terms.Select(term => term.TermId).ToList();
        var evaluations = await _context.CoachEvaluations
            .Where(evaluation => termIds.Contains(evaluation.TermId))
            .GroupBy(evaluation => evaluation.TermId)
            .Select(group => new { TermId = group.Key, sent = group.Count(), submitted = group.Count(evaluation => evaluation.Status == "SUBMITTED") })
            .ToDictionaryAsync(row => row.TermId);

        return Ok(terms
            .OrderByDescending(term => term.AcademicYear)
            .ThenByDescending(term => Array.IndexOf(IctdUniversityDatabase.Semesters, term.Semester))
            .Select(term => new
            {
                term.TermId,
                term.AcademicYear,
                term.Semester,
                term.athletes,
                term.subjects,
                term.failed,
                term.incomplete,
                term.lastPulledAt,
                evaluationsSent = evaluations.GetValueOrDefault(term.TermId)?.sent ?? 0,
                evaluationsSubmitted = evaluations.GetValueOrDefault(term.TermId)?.submitted ?? 0
            }));
    }

    /// <summary>Each athlete's pulled grades for one term.</summary>
    [HttpGet]
    public async Task<IActionResult> GetTermGrades([FromQuery] string academicYear, [FromQuery] string semester)
    {
        var term = await _context.AcademicTerms.FirstOrDefaultAsync(item =>
            item.AcademicYear == academicYear.Trim() && item.Semester == semester.Trim());
        if (term == null) return Ok(new { term = (object?)null, athletes = Array.Empty<object>() });

        var records = await _context.AcademicRecords
            .Where(record => record.TermId == term.TermId && record.SourceType == IctdSource)
            .Select(record => new
            {
                record.AthleteId,
                record.Athlete.StudentNumber,
                record.Athlete.User.FirstName,
                record.Athlete.User.LastName,
                record.Athlete.Course,
                record.Athlete.YearLevel,
                record.SubjectCode,
                record.SubjectName,
                record.SectionCode,
                record.Units,
                record.Grade,
                record.Remarks,
                record.ImportedAt
            })
            .ToListAsync();

        var athletes = records
            .GroupBy(record => record.AthleteId)
            .Select(group =>
            {
                var first = group.First();
                return new
                {
                    athleteId = group.Key,
                    first.StudentNumber,
                    first.FirstName,
                    first.LastName,
                    first.Course,
                    first.YearLevel,
                    pulledAt = group.Max(record => record.ImportedAt),
                    subjects = group.OrderBy(record => record.SubjectCode).Select(record => new
                    {
                        record.SubjectCode,
                        record.SubjectName,
                        record.SectionCode,
                        record.Units,
                        record.Grade,
                        record.Remarks
                    })
                };
            })
            .OrderBy(athlete => athlete.LastName)
            .ThenBy(athlete => athlete.FirstName)
            .ToList();

        return Ok(new { term = new { term.TermId, term.AcademicYear, term.Semester }, athletes });
    }
}
