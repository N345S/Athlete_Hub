using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class AcademicTerm
{
    public int TermId { get; set; }

    public string AcademicYear { get; set; } = null!;

    public string Semester { get; set; } = null!;

    public DateTime? StartDate { get; set; }

    public DateTime? EndDate { get; set; }

    public virtual ICollection<AcademicRecord> AcademicRecords { get; set; } = new List<AcademicRecord>();

    public virtual ICollection<EligibilityRecord> EligibilityRecords { get; set; } = new List<EligibilityRecord>();
}
