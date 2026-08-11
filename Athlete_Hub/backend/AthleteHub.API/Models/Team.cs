using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class Team
{
    public int TeamId { get; set; }

    public int SportId { get; set; }

    public int? CoachId { get; set; }

    public string TeamName { get; set; } = null!;

    public string? SchoolYear { get; set; }

    public string Status { get; set; } = null!;

    public virtual CoachProfile? Coach { get; set; }

    public virtual Sport Sport { get; set; } = null!;

    public virtual ICollection<TeamMember> TeamMembers { get; set; } = new List<TeamMember>();

    public virtual ICollection<TrainingSession> TrainingSessions { get; set; } = new List<TrainingSession>();
}
