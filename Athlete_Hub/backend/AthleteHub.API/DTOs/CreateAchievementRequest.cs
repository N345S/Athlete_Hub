namespace AthleteHub.API.DTOs;

public class CreateAchievementRequest
{
    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public DateTime? AchievementDate { get; set; }

    public string? Category { get; set; }
}