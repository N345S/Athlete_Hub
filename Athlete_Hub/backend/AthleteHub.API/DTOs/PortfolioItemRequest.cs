namespace AthleteHub.API.DTOs;

public class PortfolioItemRequest
{
    public int? AchievementId { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public int? DisplayOrder { get; set; }

    public bool? IsVisible { get; set; }
}