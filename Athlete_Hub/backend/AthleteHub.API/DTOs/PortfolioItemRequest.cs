namespace AthleteHub.API.DTOs;

public class PortfolioItemRequest
{
    public int? AchievementId { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public int? DisplayOrder { get; set; }

    public bool? IsVisible { get; set; }
}

public class PortfolioVerificationRequest
{
    public string Status { get; set; } = "VERIFIED";

    public string? RejectionReason { get; set; }
}

public class AchievementVerificationRequest
{
    public string Status { get; set; } = "VERIFIED";

    public string? RejectionReason { get; set; }
}