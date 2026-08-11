using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class CoachProfile
{
    public int CoachId { get; set; }

    public int UserId { get; set; }

    public string? Specialization { get; set; }

    public virtual ICollection<PerformanceRecord> PerformanceRecords { get; set; } = new List<PerformanceRecord>();

    public virtual ICollection<Team> Teams { get; set; } = new List<Team>();

    public virtual ICollection<TrainingSession> TrainingSessions { get; set; } = new List<TrainingSession>();

    public virtual User User { get; set; } = null!;
}
