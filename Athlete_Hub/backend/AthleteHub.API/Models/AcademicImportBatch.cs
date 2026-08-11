using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class AcademicImportBatch
{
    public int ImportBatchId { get; set; }

    public string SourceSystem { get; set; } = null!;

    public string ImportMethod { get; set; } = null!;

    public string? FileName { get; set; }

    public int? ImportedBy { get; set; }

    public string ImportStatus { get; set; } = null!;

    public DateTime? ImportedAt { get; set; }

    public virtual ICollection<AcademicRecord> AcademicRecords { get; set; } = new List<AcademicRecord>();

    public virtual User? ImportedByNavigation { get; set; }
}
