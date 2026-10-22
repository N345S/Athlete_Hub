using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class AcademicRecord
{
    public int AcademicRecordId { get; set; }

    public int AthleteId { get; set; }

    public int TermId { get; set; }

    public int? ImportBatchId { get; set; }

    public string SubjectCode { get; set; } = null!;

    public string SubjectName { get; set; } = null!;

    /// <summary>Class section from the ICTD university database, e.g. BSIT-2A.</summary>
    public string? SectionCode { get; set; }

    public decimal? Units { get; set; }

    public decimal? Grade { get; set; }

    public string? Remarks { get; set; }

    public string SourceType { get; set; } = null!;

    public DateTime? ImportedAt { get; set; }

    public virtual AthleteProfile Athlete { get; set; } = null!;

    public virtual AcademicImportBatch? ImportBatch { get; set; }

    public virtual AcademicTerm Term { get; set; } = null!;
}
