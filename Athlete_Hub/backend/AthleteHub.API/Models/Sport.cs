using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class Sport
{
    public int SportId { get; set; }

    public string SportName { get; set; } = null!;

    public string? Description { get; set; }

    public string SportType { get; set; } = null!;

    public virtual ICollection<PerformanceMetricDefinition> PerformanceMetricDefinitions { get; set; } = new List<PerformanceMetricDefinition>();

    public virtual ICollection<Team> Teams { get; set; } = new List<Team>();
}
