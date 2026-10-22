namespace AthleteHub.API.Models;

/// <summary>
/// A student-athlete's evaluation of their team coach for one term. It is sent automatically when the term's
/// final grades are released from the ICTD university database, and stays PENDING until the student submits it.
/// </summary>
public partial class CoachEvaluation
{
    public int CoachEvaluationId { get; set; }

    public int AthleteId { get; set; }

    public int CoachId { get; set; }

    public int TermId { get; set; }

    /// <summary>The team the athlete was on with this coach when the form was sent.</summary>
    public int? TeamId { get; set; }

    /// <summary>PENDING or SUBMITTED.</summary>
    public string Status { get; set; } = null!;

    /// <summary>JSON object of question key → rating from 1 to 5.</summary>
    public string? Ratings { get; set; }

    public string? Comments { get; set; }

    public DateTime? SentAt { get; set; }

    public DateTime? SubmittedAt { get; set; }

    public virtual AthleteProfile Athlete { get; set; } = null!;

    public virtual CoachProfile Coach { get; set; } = null!;

    public virtual AcademicTerm Term { get; set; } = null!;

    public virtual Team? Team { get; set; }
}
