using System.Text.Json;
using AthleteHub.API.Data;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

/// <summary>
/// Students evaluate their team coach after each term's final grades are released. Students answer their own
/// forms; the Sports Director sees each coach's results without the students' names.
/// </summary>
[ApiController]
[Route("api/CoachEvaluations")]
[Authorize]
public class CoachEvaluationsController : ControllerBase
{
    private const int MaxCommentLength = 2000;
    private readonly AthleteHubDbContext _context;

    public CoachEvaluationsController(AthleteHubDbContext context) => _context = context;

    private static object QuestionList => CoachEvaluationService.Questions.Select(question => new { key = question.Key, text = question.Text });

    /// <summary>The signed-in student's evaluation forms, unanswered first.</summary>
    [HttpGet("me")]
    [Authorize(Roles = "ATHLETE,STUDENT")]
    public async Task<IActionResult> GetMine()
    {
        var userId = AthleteAccessService.GetUserId(User);
        var evaluations = await _context.CoachEvaluations
            .Where(evaluation => evaluation.Athlete.UserId == userId)
            .OrderBy(evaluation => evaluation.Status == "SUBMITTED")
            .ThenByDescending(evaluation => evaluation.SentAt)
            .Select(evaluation => new
            {
                evaluation.CoachEvaluationId,
                evaluation.Status,
                evaluation.SentAt,
                evaluation.SubmittedAt,
                evaluation.Ratings,
                evaluation.Comments,
                coachName = evaluation.Coach.User.FirstName + " " + evaluation.Coach.User.LastName,
                teamName = evaluation.Team != null ? evaluation.Team.TeamName : null,
                term = new { evaluation.Term.AcademicYear, evaluation.Term.Semester }
            })
            .ToListAsync();

        return Ok(new
        {
            questions = QuestionList,
            evaluations = evaluations.Select(evaluation => new
            {
                evaluation.CoachEvaluationId,
                evaluation.Status,
                evaluation.SentAt,
                evaluation.SubmittedAt,
                ratings = ParseRatings(evaluation.Ratings),
                evaluation.Comments,
                evaluation.coachName,
                evaluation.teamName,
                evaluation.term
            })
        });
    }

    /// <summary>Submits a pending evaluation. Every question needs a rating from 1 to 5; comments are optional.</summary>
    [HttpPost("{evaluationId:int}")]
    [Authorize(Roles = "ATHLETE,STUDENT")]
    public async Task<IActionResult> Submit(int evaluationId, SubmitCoachEvaluationRequest request)
    {
        var userId = AthleteAccessService.GetUserId(User);
        var evaluation = await _context.CoachEvaluations
            .FirstOrDefaultAsync(item => item.CoachEvaluationId == evaluationId && item.Athlete.UserId == userId);
        if (evaluation == null) return NotFound(new { message = "Evaluation not found." });
        if (evaluation.Status == "SUBMITTED") return Conflict(new { message = "You already submitted this evaluation." });

        var ratings = request.Ratings ?? [];
        var missing = CoachEvaluationService.Questions.Where(question => !ratings.ContainsKey(question.Key)).ToList();
        if (missing.Count > 0) return BadRequest(new { message = "Rate every statement before submitting." });
        if (ratings.Keys.Any(key => CoachEvaluationService.Questions.All(question => question.Key != key)))
            return BadRequest(new { message = "One or more answers do not match the evaluation form." });
        if (ratings.Values.Any(value => value is < 1 or > 5))
            return BadRequest(new { message = "Each rating must be from 1 to 5." });

        var comments = string.IsNullOrWhiteSpace(request.Comments) ? null : request.Comments.Trim();
        if (comments?.Length > MaxCommentLength)
            return BadRequest(new { message = $"Comments must be {MaxCommentLength} characters or fewer." });

        evaluation.Ratings = JsonSerializer.Serialize(ratings);
        evaluation.Comments = comments;
        evaluation.Status = "SUBMITTED";
        evaluation.SubmittedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(new { evaluation.CoachEvaluationId, evaluation.Status, evaluation.SubmittedAt });
    }

    /// <summary>A coach's results per term: average for each statement and anonymous comments.</summary>
    [HttpGet("coach/{coachId:int}")]
    [Authorize(Roles = "DIRECTOR")]
    public async Task<IActionResult> GetCoachSummary(int coachId)
    {
        var rows = await _context.CoachEvaluations
            .Where(evaluation => evaluation.CoachId == coachId)
            .Select(evaluation => new
            {
                evaluation.TermId,
                evaluation.Term.AcademicYear,
                evaluation.Term.Semester,
                evaluation.Status,
                evaluation.Ratings,
                evaluation.Comments,
                evaluation.SubmittedAt
            })
            .ToListAsync();

        var terms = rows
            .GroupBy(row => new { row.TermId, row.AcademicYear, row.Semester })
            .OrderByDescending(group => group.Key.AcademicYear)
            .ThenByDescending(group => Array.IndexOf(IctdUniversityDatabase.Semesters, group.Key.Semester))
            .Select(group =>
            {
                var submitted = group.Where(row => row.Status == "SUBMITTED").ToList();
                var ratings = submitted.Select(row => ParseRatings(row.Ratings)).ToList();
                var averages = CoachEvaluationService.Questions.ToDictionary(
                    question => question.Key,
                    question => ratings.Where(answers => answers.ContainsKey(question.Key)).Select(answers => (double)answers[question.Key]).DefaultIfEmpty().Average());
                return new
                {
                    term = new { group.Key.AcademicYear, group.Key.Semester },
                    sent = group.Count(),
                    submitted = submitted.Count,
                    averages = submitted.Count == 0 ? null : averages.ToDictionary(pair => pair.Key, pair => Math.Round(pair.Value, 2)),
                    overallAverage = submitted.Count == 0 ? (double?)null : Math.Round(averages.Values.Average(), 2),
                    // Newest first and never with names, so comments stay anonymous.
                    comments = submitted.Where(row => row.Comments != null).OrderByDescending(row => row.SubmittedAt).Select(row => row.Comments).ToList()
                };
            })
            .ToList();

        return Ok(new { questions = QuestionList, terms });
    }

    private static Dictionary<string, int> ParseRatings(string? ratings)
    {
        if (string.IsNullOrWhiteSpace(ratings)) return [];
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, int>>(ratings) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}

public sealed class SubmitCoachEvaluationRequest
{
    public Dictionary<string, int>? Ratings { get; set; }
    public string? Comments { get; set; }
}
