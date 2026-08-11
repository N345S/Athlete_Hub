using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class PerformanceMetricDefinition
{
    public int MetricId { get; set; }

    public int SportId { get; set; }

    public string MetricName { get; set; } = null!;

    public string? Description { get; set; }

    public string? Unit { get; set; }

    public virtual ICollection<PerformanceRecord> PerformanceRecords { get; set; } = new List<PerformanceRecord>();

    public virtual Sport Sport { get; set; } = null!;
}
