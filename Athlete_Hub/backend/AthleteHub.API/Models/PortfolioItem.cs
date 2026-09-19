using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class PortfolioItem
{
    public int PortfolioItemId { get; set; }

    public int AthleteId { get; set; }

    public int? AchievementId { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public int? DisplayOrder { get; set; }

    public bool? IsVisible { get; set; }

    public DateTime? CreatedAt { get; set; }

    public string? VerificationStatus { get; set; }

    public int? VerifiedBy { get; set; }

    public DateTime? VerifiedAt { get; set; }

    public string? RejectionReason { get; set; }

    public virtual Achievement? Achievement { get; set; }

    public virtual AthleteProfile Athlete { get; set; } = null!;
}
