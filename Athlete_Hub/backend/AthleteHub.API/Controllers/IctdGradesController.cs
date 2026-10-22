using AthleteHub.API.Data;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

/// <summary>
/// Final grades pulled from the ICTD university database. Only the Sports Director can pull or see them.
/// Pulling a term's released final grades automatically sends students their coach evaluation forms.
/// </summary>
[ApiController]
[Route("api/IctdGrades")]
[Authorize(Roles = "DIRECTOR")]
public class IctdGradesController : ControllerBase
{
    // Grades pulled from ICTD are stored as API records, apart from any older file imports or manual entries.
    private const string IctdSource = "API";

    private readonly AthleteHubDbContext _context;
    private readonly IctdUniversityDatabase _ictd;
    private readonly CoachEvaluationService _evaluations;

    public IctdGradesController(AthleteHubDbContext context, IctdUniversityDatabase ictd, CoachEvaluationService evaluations)
    {
        _context = context;
        _ictd = ictd;
        _evaluations = evaluations;
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

    /// <summary>
    /// Pulls the released final grades for one term from ICTD for every active student-athlete, replacing grades
    /// pulled for that term before. Students then receive their coach evaluation forms.
    /// </summary>
    [HttpPost("pull")]
    public async Task<IActionResult> Pull(PullIctdGradesRequest request)
    {
        var academicYear = request.AcademicYear.Trim();
        var semester = request.Semester.Trim();
        var problem = _ictd.CheckTerm(academicYear, semester);
        if (problem != null) return BadRequest(new { message = problem });

        var term = await _context.AcademicTerms.FirstOrDefaultAsync(item => item.AcademicYear == academicYear && item.Semester == semester);
        if (term == null)
        {
            term = new AcademicTerm { AcademicYear = academicYear, Semester = semester };
            _context.AcademicTerms.Add(term);
            await _context.SaveChangesAsync();
        }

        var athletes = await _context.AthleteProfiles
            .Where(athlete => athlete.User.AccountStatus == "ACTIVE")
            .Select(athlete => new { athlete.AthleteId, athlete.StudentNumber, athlete.Course, athlete.YearLevel })
            .ToListAsync();
        if (athletes.Count == 0) return BadRequest(new { message = "There are no active student-athletes to pull grades for." });

        var now = DateTime.UtcNow;
        var athleteIds = athletes.Select(athlete => athlete.AthleteId).ToList();
        var subjectCount = 0;
        await using (var transaction = await _context.Database.BeginTransactionAsync())
        {
            await _context.AcademicRecords
                .Where(record => record.TermId == term.TermId && record.SourceType == IctdSource && athleteIds.Contains(record.AthleteId))
                .ExecuteDeleteAsync();

            var batch = new AcademicImportBatch
            {
                SourceSystem = IctdUniversityDatabase.SourceSystem,
                ImportMethod = "API",
                ImportStatus = "COMPLETED",
                ImportedBy = AthleteAccessService.GetUserId(User),
                ImportedAt = now
            };
            _context.AcademicImportBatches.Add(batch);

            foreach (var athlete in athletes)
            {
                var grades = _ictd.GetFinalGrades(athlete.StudentNumber, athlete.Course, athlete.YearLevel, academicYear, semester);
                subjectCount += grades.Count;
                _context.AcademicRecords.AddRange(grades.Select(grade => new AcademicRecord
                {
                    AthleteId = athlete.AthleteId,
                    TermId = term.TermId,
                    ImportBatch = batch,
                    SubjectCode = grade.SubjectCode,
                    SubjectName = grade.SubjectName,
                    SectionCode = grade.SectionCode,
                    Units = grade.Units,
                    Grade = grade.Grade,
                    Remarks = grade.Remarks,
                    SourceType = IctdSource,
                    ImportedAt = now
                }));
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }

        // Final grades are now released in Athlete-Hub, so the coach evaluations go out.
        var evaluationsSent = await _evaluations.SendForTermAsync(term);

        return Ok(new
        {
            message = $"Pulled {subjectCount} final grades for {athletes.Count} student-athletes from the ICTD database.",
            term = new { term.TermId, term.AcademicYear, term.Semester },
            athleteCount = athletes.Count,
            subjectCount,
            evaluationsSent
        });
    }
}

public sealed class PullIctdGradesRequest
{
    public string AcademicYear { get; set; } = string.Empty;
    public string Semester { get; set; } = string.Empty;
}
