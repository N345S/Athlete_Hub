using System.ComponentModel.DataAnnotations;

namespace AthleteHub.API.DTOs;

public sealed class AttendanceRequest
{
    [Required]
    public int AthleteId { get; set; }

    [Required, StringLength(30)]
    public string AttendanceStatus { get; set; } = string.Empty;

    public string? Remarks { get; set; }
}