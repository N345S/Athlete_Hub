using System.ComponentModel.DataAnnotations;

namespace AthleteHub.API.DTOs;

public sealed class TrainingSessionRequest
{
    [Required]
    public int TeamId { get; set; }

    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }
    public DateTime TrainingDate { get; set; }
    public List<DateTime>? TrainingDates { get; set; }
    public TimeSpan? StartTime { get; set; }
    public TimeSpan? EndTime { get; set; }
    public string? Location { get; set; }
}