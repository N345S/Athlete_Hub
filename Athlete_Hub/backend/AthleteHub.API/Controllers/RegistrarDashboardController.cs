using AthleteHub.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/RegistrarDashboard")]
[Authorize(Roles = "REGISTRAR")]
public class RegistrarDashboardController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public RegistrarDashboardController(AthleteHubDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetDashboard()
    {
        var athletes = await _context.AthleteProfiles
            .AsNoTracking()
            .Include(athlete => athlete.User)
            .Include(athlete => athlete.AcademicRecords)
            .Include(athlete => athlete.EligibilityRecords)
            .ToListAsync();

        var students = athletes.Select(athlete =>
        {
            var grades = athlete.AcademicRecords
                .Where(record => record.Grade.HasValue)
                .Select(record => record.Grade!.Value)
                .ToList();
            var latestEligibility = athlete.EligibilityRecords
                .OrderByDescending(record => record.EvaluatedAt)
                .FirstOrDefault();
            var averageGrade = grades.Count == 0 ? (decimal?)null : Math.Round(grades.Average(), 2);
            var status = latestEligibility?.AcademicStatus
                ?? (averageGrade.HasValue && averageGrade.Value <= 3.00m ? "ELIGIBLE" : "NEEDS_REVIEW");

            return new
            {
                athleteId = athlete.AthleteId,
                studentNumber = athlete.StudentNumber,
                firstName = athlete.User.FirstName,
                lastName = athlete.User.LastName,
                course = athlete.Course,
                yearLevel = athlete.YearLevel,
                averageGrade,
                eligibilityStatus = status,
                eligibilityRemarks = latestEligibility?.Remarks,
                records = athlete.AcademicRecords.Select(record => new
                {
                    record.AcademicRecordId,
                    record.SubjectCode,
                    record.SubjectName,
                    record.Units,
                    record.Grade,
                    record.Remarks,
                    termId = record.TermId
                }).ToList()
            };
        }).ToList();

        var eligibleCount = students.Count(student => student.eligibilityStatus.Equals("ELIGIBLE", StringComparison.OrdinalIgnoreCase));
        var averageGpa = students.Where(student => student.averageGrade.HasValue).Select(student => student.averageGrade!.Value).DefaultIfEmpty().Average();
        var attentionStudents = students.Where(student => !student.eligibilityStatus.Equals("ELIGIBLE", StringComparison.OrdinalIgnoreCase)).ToList();

        return Ok(new
        {
            totalStudents = students.Count,
            averageGpa = students.Any(student => student.averageGrade.HasValue) ? Math.Round(averageGpa, 2) : (decimal?)null,
            eligibleCount,
            attentionCount = attentionStudents.Count,
            students,
            attentionStudents
        });
    }
}
