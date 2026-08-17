using System.Security.Claims;
using AthleteHub.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AcademicRecordsController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public AcademicRecordsController(AthleteHubDbContext context)
    {
        _context = context;
    }


    // ==========================================
    // GET CURRENT ATHLETE'S ACADEMIC RECORDS
    // GET: /api/AcademicRecords/me
    // ==========================================

    [Authorize(Roles = "ATHLETE")]
    [HttpGet("me")]
    public async Task<IActionResult> GetMyAcademicRecords()
    {
        // Get User ID from JWT
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        if (string.IsNullOrEmpty(userIdClaim))
        {
            return Unauthorized(new
            {
                message = "User ID was not found in the JWT."
            });
        }

        // Convert User ID to integer
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new
            {
                message = "Invalid User ID in JWT."
            });
        }


        // Find the athlete profile belonging
        // to the authenticated user
        var athlete = await _context.AthleteProfiles
            .FirstOrDefaultAsync(a => a.UserId == userId);

        if (athlete == null)
        {
            return NotFound(new
            {
                message = "Athlete profile not found.",
                userId = userId
            });
        }


        // Get academic records
        var records = await _context.AcademicRecords
            .Where(a => a.AthleteId == athlete.AthleteId)
            .OrderByDescending(a => a.AcademicRecordId)
            .Select(a => new
            {
                academicRecordId = a.AcademicRecordId,

                athleteId = a.AthleteId,

                termId = a.TermId,

                importBatchId = a.ImportBatchId,

                subjectCode = a.SubjectCode,

                subjectName = a.SubjectName,

                units = a.Units,

                grade = a.Grade,

                remarks = a.Remarks,

                sourceType = a.SourceType,

                importedAt = a.ImportedAt
            })
            .ToListAsync();


        // Return records
        return Ok(new
        {
            endpoint = "GET /api/AcademicRecords/me",

            message = "Academic records retrieved successfully.",

            athleteId = athlete.AthleteId,

            recordCount = records.Count,

            records
        });
    }
}