using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class EligibilityRecord
{
    public int EligibilityId { get; set; }

    public int AthleteId { get; set; }

    public int TermId { get; set; }

    public string AcademicStatus { get; set; } = null!;

    public string? Remarks { get; set; }

    public DateTime? EvaluatedAt { get; set; }

    public int? DocumentId { get; set; }

    public int? RequestedBy { get; set; }

    public DateTime? RequestedAt { get; set; }

    public int? UploadedBy { get; set; }

    public int? ReviewedBy { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public string? EligibilityReasons { get; set; }

    public virtual AthleteProfile Athlete { get; set; } = null!;

    public virtual AcademicTerm Term { get; set; } = null!;
}
