using System.ComponentModel.DataAnnotations;

namespace AthleteHub.API.DTOs;

public sealed class EligibilityRecordRequest
{
    [Required]
    public int AthleteId { get; set; }

    [Required]
    public int TermId { get; set; }

    [Required, StringLength(30)]
    public string AcademicStatus { get; set; } = string.Empty;

    public string? Remarks { get; set; }
}