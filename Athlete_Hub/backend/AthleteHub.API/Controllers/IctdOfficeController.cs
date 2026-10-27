using AthleteHub.API.Data;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

/// <summary>
/// The ICTD grades office page (see <see cref="IctdOffice"/>): shows the final grades ICTD will release for the next
/// terms and releases them early, which sends the coach evaluations, so the end of a term can be tested at any time.
/// Only terms whose release date has not come yet can be released early or taken back.
/// </summary>
[ApiController]
[Route("api/IctdOffice")]
[Authorize(Roles = IctdOffice.Role)]
public class IctdOfficeController : ControllerBase
{
    private const int TermsShown = 2;

    private readonly AthleteHubDbContext _context;
    private readonly IctdUniversityDatabase _ictd;
    private readonly IctdGradeSync _sync;

    public IctdOfficeController(AthleteHubDbContext context, IctdUniversityDatabase ictd, IctdGradeSync sync)
    {
        _context = context;
        _ictd = ictd;
        _sync = sync;
    }

    public record TermRequest(string AcademicYear, string Semester);

    /// <summary>The upcoming terms with how far each has got: grades released, evaluations sent and answered.</summary>
    [HttpGet("terms")]
    public async Task<IActionResult> GetTerms()
    {
        var activeAthletes = await _context.AthleteProfiles.CountAsync(athlete => athlete.User.AccountStatus == "ACTIVE");
        var terms = new List<object>();
        foreach (var (academicYear, semester, releasesOn) in _ictd.UpcomingTerms(TermsShown))
        {
            var termId = await _context.AcademicTerms
                .Where(term => term.AcademicYear == academicYear && term.Semester == semester)
                .Select(term => (int?)term.TermId)
                .FirstOrDefaultAsync();
            var graded = termId == null ? 0 : await _context.AcademicRecords
                .Where(record => record.TermId == termId && record.SourceType == IctdGradeSync.IctdSource)
                .Select(record => record.AthleteId).Distinct().CountAsync();
            var evaluations = termId == null ? [] : await _context.CoachEvaluations
                .Where(evaluation => evaluation.TermId == termId)
                .Select(evaluation => evaluation.Status)
                .ToListAsync();
            terms.Add(new
            {
                academicYear,
                semester,
                releasesOn = releasesOn.ToString("yyyy-MM-dd"),
                studentsWithGrades = graded,
                evaluationsSent = evaluations.Count,
                evaluationsAnswered = evaluations.Count(status => status == "SUBMITTED")
            });
        }
        return Ok(new { activeAthletes, terms });
    }

    /// <summary>The grade sheet ICTD would release for a term: every active student-athlete's subjects and grades.</summary>
    [HttpGet("grades")]
    public async Task<IActionResult> GetGradeSheet(string academicYear, string semester)
    {
        if (!IsUpcoming(academicYear, semester)) return BadRequest(new { message = NotUpcomingMessage });

        var athletes = await _context.AthleteProfiles
            .Where(athlete => athlete.User.AccountStatus == "ACTIVE")
            .OrderBy(athlete => athlete.User.LastName).ThenBy(athlete => athlete.User.FirstName)
            .Select(athlete => new
            {
                athlete.AthleteId,
                athlete.StudentNumber,
                athlete.User.FirstName,
                athlete.User.LastName,
                athlete.Course,
                athlete.YearLevel,
                // The coaches this student will be asked to evaluate.
                coaches = athlete.TeamMembers
                    .Where(member => member.DateLeft == null && member.Team.CoachId != null)
                    .Select(member => member.Team.Coach!.User.FirstName + " " + member.Team.Coach.User.LastName)
                    .ToList()
            })
            .ToListAsync();

        return Ok(athletes.Select(athlete =>
        {
            var grades = _ictd.GetFinalGrades(athlete.StudentNumber, athlete.Course, athlete.YearLevel, academicYear, semester);
            var counted = grades.Where(grade => grade.Grade.HasValue).ToList();
            var units = counted.Sum(grade => grade.Units);
            return new
            {
                athlete.AthleteId,
                athlete.StudentNumber,
                athlete.FirstName,
                athlete.LastName,
                athlete.Course,
                athlete.YearLevel,
                // A coach of two of the student's teams is evaluated once.
                coaches = athlete.coaches.Distinct(),
                // General weighted average: lower is better on the Philippine scale; INC subjects are left out.
                gwa = units > 0 ? Math.Round(counted.Sum(grade => grade.Grade!.Value * grade.Units) / units, 2) : (decimal?)null,
                subjects = grades.Select(grade => new { grade.SubjectCode, grade.SubjectName, grade.SectionCode, grade.Units, grade.Grade, grade.Remarks })
            };
        }));
    }

    /// <summary>Releases a term's final grades now and sends the coach evaluations.</summary>
    [HttpPost("release")]
    public async Task<IActionResult> Release(TermRequest request)
    {
        if (!IsUpcoming(request.AcademicYear, request.Semester)) return BadRequest(new { message = NotUpcomingMessage });
        var (graded, sent) = await _sync.ReleaseEarlyAsync(request.AcademicYear, request.Semester);
        return Ok(new
        {
            studentsGraded = graded,
            evaluationsSent = sent,
            message = graded == 0 && sent == 0
                ? "These grades were already released. Nothing new was sent."
                : $"Grades released for {graded} student-athlete{(graded == 1 ? "" : "s")}; {sent} coach evaluation{(sent == 1 ? "" : "s")} sent."
        });
    }

    /// <summary>Takes an early release back (grades, evaluations, and their notifications) so it can be tested again.</summary>
    [HttpPost("take-back")]
    public async Task<IActionResult> TakeBack(TermRequest request)
    {
        if (!IsUpcoming(request.AcademicYear, request.Semester)) return BadRequest(new { message = NotUpcomingMessage });
        var (grades, evaluations) = await _sync.TakeBackAsync(request.AcademicYear, request.Semester);
        return Ok(new
        {
            gradesDeleted = grades,
            evaluationsDeleted = evaluations,
            message = $"Taken back: {evaluations} coach evaluation{(evaluations == 1 ? "" : "s")} and the grades were removed."
        });
    }

    private const string NotUpcomingMessage = "Only a term whose grades are not released yet can be released early or taken back.";

    private bool IsUpcoming(string? academicYear, string? semester) =>
        _ictd.UpcomingTerms(TermsShown).Any(term => term.AcademicYear == academicYear && term.Semester == semester);
}
