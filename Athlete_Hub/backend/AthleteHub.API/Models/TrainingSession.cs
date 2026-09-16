using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class TrainingSession
{
    public int TrainingSessionId { get; set; }

    public int TeamId { get; set; }

    public int CoachId { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public DateTime TrainingDate { get; set; }

    public TimeSpan? StartTime { get; set; }

    public TimeSpan? EndTime { get; set; }

    public string? Location { get; set; }

    public string ApprovalStatus { get; set; } = "PENDING";

    public DateTime? SubmittedAt { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public int? ReviewedBy { get; set; }

    public string? RejectionReason { get; set; }

    public virtual ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();

    public virtual CoachProfile Coach { get; set; } = null!;

    public virtual Team Team { get; set; } = null!;
}
