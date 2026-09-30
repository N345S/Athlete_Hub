using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class PerformanceRecord
{
    public int PerformanceRecordId { get; set; }

    public int AthleteId { get; set; }

    public int MetricId { get; set; }

    public decimal RecordedValue { get; set; }

    public DateTime RecordedDate { get; set; }

    public int? CoachId { get; set; }

    public string? Notes { get; set; }

    // New fields for universal performance tracking
    public string? DataType { get; set; }

    public string? Unit { get; set; }

    public int? SessionId { get; set; }

    public virtual AthleteProfile Athlete { get; set; } = null!;

    public virtual CoachProfile? Coach { get; set; }

    public virtual PerformanceMetricDefinition Metric { get; set; } = null!;
    
    // Navigation property for training session
    public virtual TrainingSession? Session { get; set; }
}
