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

    public virtual AthleteProfile Athlete { get; set; } = null!;

    public virtual AcademicTerm Term { get; set; } = null!;
}
