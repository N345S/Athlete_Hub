using AthleteHub.API.Data;
using AthleteHub.API.Models;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Services;

/// <summary>
/// Sends students the form to evaluate their team coach once a term's final grades are released, and holds the
/// questions every evaluation answers.
/// </summary>
public class CoachEvaluationService
{
    /// <summary>Each question is rated from 1 (strongly disagree) to 5 (strongly agree).</summary>
    public static readonly (string Key, string Text)[] Questions =
    [
        ("communication", "My coach explains drills, plays, and expectations clearly."),
        ("preparation", "Training sessions are organized and well prepared."),
        ("fairness", "My coach treats every athlete fairly and with respect."),
        ("development", "My coach helps me improve my skills and performance."),
        ("wellbeing", "My coach looks after my safety, health, and well-being."),
        ("academics", "My coach supports me in balancing sports and my studies."),
        ("overall", "Overall, I am satisfied with my coach this semester."),
    ];

    private readonly AthleteHubDbContext _context;
    private readonly NotificationService _notifications;

    public CoachEvaluationService(AthleteHubDbContext context, NotificationService notifications)
    {
        _context = context;
        _notifications = notifications;
    }

    /// <summary>
    /// Gives every active student with released ICTD grades for the term an evaluation form for each coach of the
    /// teams they are on, and notifies them. Forms already sent for the term are not sent again, so pulling the
    /// same term twice is safe. Returns how many forms were sent.
    /// </summary>
    public async Task<int> SendForTermAsync(AcademicTerm term)
    {
        var gradedAthleteIds = _context.AcademicRecords
            .Where(record => record.TermId == term.TermId && record.SourceType == "API")
            .Select(record => record.AthleteId);

        var coachedBy = await _context.TeamMembers
            .Where(member => gradedAthleteIds.Contains(member.AthleteId)
                && member.DateLeft == null
                && member.Team.CoachId != null
                && member.Athlete.User.AccountStatus == "ACTIVE")
            .Select(member => new
            {
                member.AthleteId,
                AthleteUserId = member.Athlete.UserId,
                CoachId = member.Team.CoachId!.Value,
                member.TeamId,
                CoachName = member.Team.Coach!.User.FirstName + " " + member.Team.Coach.User.LastName
            })
            .ToListAsync();

        var alreadySent = (await _context.CoachEvaluations
                .Where(evaluation => evaluation.TermId == term.TermId)
                .Select(evaluation => new { evaluation.AthleteId, evaluation.CoachId })
                .ToListAsync())
            .Select(evaluation => (evaluation.AthleteId, evaluation.CoachId))
            .ToHashSet();

        // A coach of two of the athlete's teams is evaluated once.
        var toSend = coachedBy
            .DistinctBy(row => (row.AthleteId, row.CoachId))
            .Where(row => !alreadySent.Contains((row.AthleteId, row.CoachId)))
            .ToList();
        if (toSend.Count == 0) return 0;

        var now = DateTime.UtcNow;
        _context.CoachEvaluations.AddRange(toSend.Select(row => new CoachEvaluation
        {
            AthleteId = row.AthleteId,
            CoachId = row.CoachId,
            TeamId = row.TeamId,
            TermId = term.TermId,
            Status = "PENDING",
            SentAt = now
        }));

        foreach (var athlete in toSend.GroupBy(row => row.AthleteUserId))
        {
            var coaches = string.Join(" and ", athlete.Select(row => $"Coach {row.CoachName}"));
            _notifications.Notify(athlete.Key,
                "Evaluate your coach",
                $"Final grades for {term.Semester} {term.AcademicYear} have been released. Please take a few minutes to evaluate {coaches}.",
                "COACH_EVALUATION");
        }

        await _context.SaveChangesAsync();
        return toSend.Count;
    }
}
