namespace AthleteHub.API.DTOs;

public class PortfolioItemResponse
{
    public int PortfolioItemId { get; set; }

    public int? AchievementId { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public int? DisplayOrder { get; set; }

    public bool? IsVisible { get; set; }

    public DateTime? CreatedAt { get; set; }
}