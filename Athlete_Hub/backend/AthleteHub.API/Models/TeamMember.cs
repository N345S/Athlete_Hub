using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class TeamMember
{
    public int TeamMemberId { get; set; }

    public int TeamId { get; set; }

    public int AthleteId { get; set; }

    public DateTime? DateJoined { get; set; }

    public DateTime? DateLeft { get; set; }

    public virtual AthleteProfile Athlete { get; set; } = null!;

    public virtual Team Team { get; set; } = null!;
}
