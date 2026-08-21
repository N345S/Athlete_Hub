using AthleteHub.API.Data;
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
}