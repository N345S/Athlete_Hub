using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class Achievement
{
    public int AchievementId { get; set; }

    public int AthleteId { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public DateTime? AchievementDate { get; set; }

    public string? Category { get; set; }

    public string VerificationStatus { get; set; } = null!;

    public int? VerifiedBy { get; set; }

    public DateTime? VerifiedAt { get; set; }

    public string? RejectionReason { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual AthleteProfile Athlete { get; set; } = null!;

    public virtual ICollection<PortfolioItem> PortfolioItems { get; set; } = new List<PortfolioItem>();

    public virtual User? VerifiedByNavigation { get; set; }
}
