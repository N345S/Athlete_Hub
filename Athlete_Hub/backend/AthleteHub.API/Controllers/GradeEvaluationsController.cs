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
[Authorize(Roles = "REGISTRAR")]
public class GradeEvaluationsController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public GradeEvaluationsController(AthleteHubDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> SendGradeEvaluation(SendGradeEvaluationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.AcademicYear)
            || string.IsNullOrWhiteSpace(request.Semester))
        {
            return BadRequest(new
            {
                message = "Academic year and semester are required."
            });
        }

        if (request.Records.Any(record =>
                string.IsNullOrWhiteSpace(record.SubjectCode)
                || string.IsNullOrWhiteSpace(record.SubjectName)))
        {
            return BadRequest(new
            {
                message = "Every grade evaluation must include a subject code and subject name."
            });
        }

        if (request.Records.Any(record => record.Grade is < 0 or > 100))
        {
            return BadRequest(new
            {
                message = "Grades must be between 0 and 100."
            });
        }

        var athleteExists = await _context.AthleteProfiles
            .AnyAsync(athlete => athlete.AthleteId == request.AthleteId);

        if (!athleteExists)
        {
            return NotFound(new { message = "Athlete profile not found." });
        }

        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var registrarId))
        {
            return Unauthorized(new { message = "Registrar ID was not found in the JWT." });
        }

        await using var transaction = await _context.Database.BeginTransactionAsync();

        var term = await _context.AcademicTerms
            .FirstOrDefaultAsync(currentTerm =>
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

        var batch = new AcademicImportBatch
        {
            SourceSystem = "REGISTRAR",
            ImportMethod = "API",
            ImportStatus = "COMPLETED",
            ImportedBy = registrarId,
            ImportedAt = DateTime.UtcNow
        };

        _context.AcademicImportBatches.Add(batch);
        await _context.SaveChangesAsync();

        var records = request.Records.Select(record => new AcademicRecord
        {
            AthleteId = request.AthleteId,
            TermId = term.TermId,
            ImportBatchId = batch.ImportBatchId,
            SubjectCode = record.SubjectCode.Trim(),
            SubjectName = record.SubjectName.Trim(),
            Units = record.Units,
            Grade = record.Grade,
            Remarks = record.Remarks,
            SourceType = "API",
            ImportedAt = DateTime.UtcNow
        });

        _context.AcademicRecords.AddRange(records);
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return Ok(new
        {
            message = "Grade evaluation sent successfully.",
            importBatchId = batch.ImportBatchId,
            athleteId = request.AthleteId,
            termId = term.TermId,
            academicYear = term.AcademicYear,
            semester = term.Semester,
            recordCount = request.Records.Count,
            source = "REGISTRAR"
        });
    }
}