namespace AthleteHub.API.Models;

/// <summary>
/// Links a parent account to one of their children's athlete profiles.
/// A parent sees only the training of athletes linked here.
/// </summary>
public partial class ParentAthlete
{
    public int ParentAthleteId { get; set; }

    public int ParentUserId { get; set; }

    public int AthleteId { get; set; }

    public string? Relationship { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual User ParentUser { get; set; } = null!;

    public virtual AthleteProfile Athlete { get; set; } = null!;
}
