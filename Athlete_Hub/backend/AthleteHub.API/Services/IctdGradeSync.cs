using AthleteHub.API.Data;
using AthleteHub.API.Models;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Services;

/// <summary>
/// Copies released final grades from the ICTD university database into Athlete-Hub. Nobody pulls grades by hand:
/// <see cref="IctdGradeSyncWorker"/> runs this on a schedule, so a term's grades appear soon after ICTD releases them.
/// </summary>
public class IctdGradeSync
{
    // Grades from ICTD are stored as API records, apart from any older file imports or manual entries.
    public const string IctdSource = "API";

    private readonly AthleteHubDbContext _context;
    private readonly IctdUniversityDatabase _ictd;
    private readonly CoachEvaluationService _evaluations;
    private readonly int _termsToSync;

    public IctdGradeSync(AthleteHubDbContext context, IctdUniversityDatabase ictd, CoachEvaluationService evaluations, IConfiguration configuration)
    {
        _context = context;
        _ictd = ictd;
        _evaluations = evaluations;
        // One academic year back by default, so a student-athlete who joins mid-year still gets last year's grades.
        _termsToSync = Math.Max(1, configuration.GetValue("Ictd:TermsToSync", 3));
    }

    /// <summary>
    /// Pulls every recently released term for each active student-athlete who does not have its grades yet, then
    /// sends coach evaluation forms for the newest term. Released grades do not change, so running this again
    /// only adds what is missing. Returns how many student-athletes received grades.
    /// </summary>
    public async Task<int> SyncAsync(CancellationToken cancellationToken = default)
    {
        var released = _ictd.ReleasedTerms(_termsToSync);
        var athletes = await _context.AthleteProfiles
            .Where(athlete => athlete.User.AccountStatus == "ACTIVE")
            .Select(athlete => new { athlete.AthleteId, athlete.StudentNumber, athlete.Course, athlete.YearLevel })
            .ToListAsync(cancellationToken);
        if (released.Count == 0 || athletes.Count == 0) return 0;

        var pulled = 0;
        AcademicTerm? newest = null;
        // Oldest first, so the import batches are in the order ICTD released the terms.
        foreach (var (academicYear, semester) in released.Reverse())
        {
            var term = await _context.AcademicTerms.FirstOrDefaultAsync(item => item.AcademicYear == academicYear && item.Semester == semester, cancellationToken);
            if (term == null)
            {
                term = new AcademicTerm { AcademicYear = academicYear, Semester = semester };
                _context.AcademicTerms.Add(term);
                await _context.SaveChangesAsync(cancellationToken);
            }
            newest = term;

            var graded = (await _context.AcademicRecords
                    .Where(record => record.TermId == term.TermId && record.SourceType == IctdSource)
                    .Select(record => record.AthleteId)
                    .Distinct()
                    .ToListAsync(cancellationToken))
                .ToHashSet();
            var missing = athletes.Where(athlete => !graded.Contains(athlete.AthleteId)).ToList();
            if (missing.Count == 0) continue;

            var now = DateTime.UtcNow;
            var batch = new AcademicImportBatch
            {
                SourceSystem = IctdUniversityDatabase.SourceSystem,
                ImportMethod = "API",
                ImportStatus = "COMPLETED",
                ImportedAt = now
            };
            _context.AcademicImportBatches.Add(batch);

            foreach (var athlete in missing)
            {
                var grades = _ictd.GetFinalGrades(athlete.StudentNumber, athlete.Course, athlete.YearLevel, academicYear, semester);
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

            // One save per term, so a term is never left half pulled.
            await _context.SaveChangesAsync(cancellationToken);
            pulled += missing.Count;
        }

        // Students evaluate their coach for the term that just ended, not for older terms caught up on.
        if (newest != null) await _evaluations.SendForTermAsync(newest);
        return pulled;
    }
}
