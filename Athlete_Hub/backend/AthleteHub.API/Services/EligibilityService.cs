using System.Text.Json;
using AthleteHub.API.Data;
using AthleteHub.API.Models;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Services;

/// <summary>
/// Decides whether each student-athlete may play in events, using written rules instead of a manual decision:
/// <list type="number">
/// <item>The account is active.</item>
/// <item>No failed (5.00) or incomplete (INC) grade in the latest regular semester released by ICTD.</item>
/// <item>At least <see cref="MinimumUnits"/> units enrolled in that semester.</item>
/// <item>Every document type the Sports Director marked as required (Medical Clearance by default) is on file.</item>
/// </list>
/// An athlete who breaks any rule is RESTRICTED, with the reasons listed. One whose grades have not been released
/// yet is UNDER_REVIEW. Everyone else is ELIGIBLE. When a status changes, the athlete and their coaches are told.
/// </summary>
public class EligibilityService
{
    public const string Eligible = "ELIGIBLE";
    public const string Restricted = "RESTRICTED";
    public const string UnderReview = "UNDER_REVIEW";

    // Summer classes are a short, optional load, so the unit and grade rules use the regular semesters.
    private static readonly string[] RegularSemesters = ["1st Semester", "2nd Semester"];

    private readonly AthleteHubDbContext _context;
    private readonly NotificationService _notifications;

    public EligibilityService(AthleteHubDbContext context, NotificationService notifications, IConfiguration configuration)
    {
        _context = context;
        _notifications = notifications;
        MinimumUnits = Math.Max(0, configuration.GetValue("Eligibility:MinimumUnits", 15));
    }

    /// <summary>Fewest units a student-athlete must be enrolled in during the semester.</summary>
    public int MinimumUnits { get; }

    public sealed record Result(int AthleteId, string Status, IReadOnlyList<string> Reasons, string? Term, decimal? Units);

    /// <summary>The rules in plain words, for the pages that explain why someone is restricted.</summary>
    public async Task<object> DescribeRulesAsync() => new
    {
        minimumUnits = MinimumUnits,
        requiredDocuments = await RequiredDocumentsAsync(),
        rules = new[]
        {
            "The student-athlete's account is active.",
            "No failed (5.00) or incomplete (INC) grade in the latest regular semester released by ICTD.",
            $"Enrolled in at least {MinimumUnits} units in that semester.",
            "Every required clearance document is on file."
        },
        statuses = new[]
        {
            new { status = Eligible, meaning = "Meets every rule and may be included in event lineups." },
            new { status = Restricted, meaning = "Breaks at least one rule and cannot be included in event lineups until it is fixed." },
            new { status = UnderReview, meaning = "No released semester grades yet, so the grade and unit rules cannot be checked." }
        }
    };

    public Task<List<string>> RequiredDocumentsAsync() => _context.DocumentTypes
        .Where(type => type.RequiredForEligibility)
        .OrderBy(type => type.Name)
        .Select(type => type.Name)
        .ToListAsync();

    /// <summary>Checks the rules for the given athletes (or everyone) without saving anything.</summary>
    public async Task<Dictionary<int, Result>> EvaluateAsync(IReadOnlyCollection<int>? athleteIds = null)
    {
        var athletesQuery = _context.AthleteProfiles.AsNoTracking();
        if (athleteIds != null) athletesQuery = athletesQuery.Where(athlete => athleteIds.Contains(athlete.AthleteId));
        var athletes = await athletesQuery
            .Select(athlete => new { athlete.AthleteId, athlete.User.AccountStatus })
            .ToListAsync();
        var ids = athletes.Select(athlete => athlete.AthleteId).ToList();
        if (ids.Count == 0) return [];

        var required = await RequiredDocumentsAsync();
        var documentsOnFile = (await _context.Documents.AsNoTracking()
                .Where(document => ids.Contains(document.AthleteId) && required.Contains(document.DocumentType))
                .Select(document => new { document.AthleteId, document.DocumentType })
                .Distinct()
                .ToListAsync())
            .GroupBy(document => document.AthleteId)
            .ToDictionary(group => group.Key, group => group.Select(document => document.DocumentType).ToHashSet(StringComparer.OrdinalIgnoreCase));

        var grades = await _context.AcademicRecords.AsNoTracking()
            .Where(record => ids.Contains(record.AthleteId) && record.SourceType == IctdGradeSync.IctdSource && RegularSemesters.Contains(record.Term.Semester))
            .Select(record => new
            {
                record.AthleteId,
                record.TermId,
                record.Term.AcademicYear,
                record.Term.Semester,
                record.SubjectCode,
                record.Units,
                record.Grade,
                record.Remarks
            })
            .ToListAsync();
        // Each athlete's latest regular semester: the newest school year, then 2nd before 1st Semester.
        var latestTermGrades = grades
            .GroupBy(grade => grade.AthleteId)
            .ToDictionary(group => group.Key, group =>
            {
                var latest = group
                    .OrderByDescending(grade => grade.AcademicYear, StringComparer.Ordinal)
                    .ThenByDescending(grade => Array.IndexOf(RegularSemesters, grade.Semester))
                    .First();
                return group.Where(grade => grade.TermId == latest.TermId).ToList();
            });

        var results = new Dictionary<int, Result>();
        foreach (var athlete in athletes)
        {
            var reasons = new List<string>();
            if (!string.Equals(athlete.AccountStatus, "ACTIVE", StringComparison.OrdinalIgnoreCase))
                reasons.Add($"Account is {athlete.AccountStatus.ToLowerInvariant()}");

            var onFile = documentsOnFile.GetValueOrDefault(athlete.AthleteId) ?? [];
            reasons.AddRange(required.Where(type => !onFile.Contains(type)).Select(type => $"{type} not on file"));

            string? term = null;
            decimal? units = null;
            var hasGrades = latestTermGrades.TryGetValue(athlete.AthleteId, out var semester);
            if (hasGrades)
            {
                term = $"{semester![0].Semester} {semester[0].AcademicYear}";
                units = semester.Sum(grade => grade.Units ?? 0);
                foreach (var grade in semester)
                {
                    var remark = (grade.Remarks ?? string.Empty).Trim().ToUpperInvariant();
                    if (remark is "INC" or "INCOMPLETE") reasons.Add($"Incomplete grade in {grade.SubjectCode}");
                    else if (remark is "FAILED" or "DROPPED" || grade.Grade >= 5.00m) reasons.Add($"Failed {grade.SubjectCode} ({grade.Grade:0.00})");
                }
                if (units < MinimumUnits) reasons.Add($"Enrolled in {units:0.#} units; at least {MinimumUnits} required");
            }

            var status = reasons.Count > 0 ? Restricted : hasGrades ? Eligible : UnderReview;
            if (status == UnderReview) reasons.Add("Waiting for ICTD to release semester grades");
            results[athlete.AthleteId] = new Result(athlete.AthleteId, status, reasons, term, units);
        }
        return results;
    }

    /// <summary>
    /// Re-checks the rules, saves any status that changed, and tells the athlete and their coaches when someone
    /// becomes restricted or is cleared. Returns the current results.
    /// </summary>
    public async Task<Dictionary<int, Result>> RefreshAsync(IReadOnlyCollection<int>? athleteIds = null)
    {
        var results = await EvaluateAsync(athleteIds);
        if (results.Count == 0) return results;

        var ids = results.Keys.ToList();
        var profiles = await _context.AthleteProfiles
            .Include(athlete => athlete.User)
            .Where(athlete => ids.Contains(athlete.AthleteId))
            .ToListAsync();
        var now = DateTime.UtcNow;
        var changed = false;
        foreach (var profile in profiles)
        {
            var result = results[profile.AthleteId];
            var reasonsJson = JsonSerializer.Serialize(result.Reasons);
            if (profile.EligibilityStatus == result.Status && profile.EligibilityReasons == reasonsJson) continue;

            var previous = profile.EligibilityStatus;
            profile.EligibilityStatus = result.Status;
            profile.EligibilityReasons = reasonsJson;
            profile.EligibilityCheckedAt = now;
            changed = true;

            var name = $"{profile.User.FirstName} {profile.User.LastName}";
            var why = string.Join("; ", result.Reasons);
            if (result.Status == Restricted && previous != Restricted)
            {
                _notifications.Notify(await _notifications.CoachUserIdsForAthleteAsync(profile.AthleteId),
                    "Athlete restricted from events",
                    $"{name} is restricted and cannot be included in event lineups. Reason: {why}.",
                    "ELIGIBILITY_RESTRICTED");
                _notifications.Notify(profile.UserId,
                    "You are restricted from events",
                    $"You cannot be included in event lineups until this is fixed: {why}.",
                    "ELIGIBILITY_RESTRICTED");
            }
            else if (result.Status == Eligible && previous == Restricted)
            {
                _notifications.Notify(await _notifications.CoachUserIdsForAthleteAsync(profile.AthleteId),
                    "Athlete eligible again",
                    $"{name} now meets every eligibility rule and can be included in event lineups.",
                    "ELIGIBILITY_CLEARED");
                _notifications.Notify(profile.UserId,
                    "You are eligible again",
                    "You meet every eligibility rule and can be included in event lineups.",
                    "ELIGIBILITY_CLEARED");
            }
        }
        if (changed) await _context.SaveChangesAsync();
        return results;
    }

    /// <summary>The fields every athlete list sends for the eligibility badge.</summary>
    public static object Describe(Result? result) => new
    {
        status = result?.Status ?? UnderReview,
        reasons = result?.Reasons ?? [],
        term = result?.Term,
        units = result?.Units
    };
}
