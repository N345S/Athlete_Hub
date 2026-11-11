namespace AthleteHub.API.Models;

/// <summary>
/// The players a coach sends to a sports event or competition for one team. The coach picks only eligible
/// team members, the event's qualification rules are checked, and the Sports Director approves it.
/// </summary>
public class EventLineup
{
    public int LineupId { get; set; }

    public int ScheduleId { get; set; }

    public int TeamId { get; set; }

    /// <summary>PENDING (waiting for the Director), APPROVED or REJECTED.</summary>
    public string Status { get; set; } = null!;

    public string? Notes { get; set; }

    public int? SubmittedBy { get; set; }

    public DateTime? SubmittedAt { get; set; }

    public int? ReviewedBy { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public string? ReviewNote { get; set; }

    public virtual Schedule Schedule { get; set; } = null!;

    public virtual Team Team { get; set; } = null!;

    public virtual ICollection<EventLineupPlayer> Players { get; set; } = new List<EventLineupPlayer>();
}

public class EventLineupPlayer
{
    public int LineupPlayerId { get; set; }

    public int LineupId { get; set; }

    public int AthleteId { get; set; }

    /// <summary>Optional position or role, e.g. "Point guard" or "Reserve".</summary>
    public string? Position { get; set; }

    public virtual EventLineup Lineup { get; set; } = null!;

    public virtual AthleteProfile Athlete { get; set; } = null!;
}
