using System.ComponentModel.DataAnnotations;

namespace AthleteHub.API.DTOs;

public sealed class ScheduleRequest
{
    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    [Required, StringLength(30)]
    public string ScheduleType { get; set; } = string.Empty;

    [Required]
    public DateTime? StartDate { get; set; }

    [Required]
    public TimeSpan? StartTime { get; set; }

    public List<DateTime>? Dates { get; set; }
    public DateTime? EndDate { get; set; }
    public TimeSpan? EndTime { get; set; }
    public string? Location { get; set; }
}