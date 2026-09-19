using System.ComponentModel.DataAnnotations;

namespace AthleteHub.API.DTOs;

public class UpdateAcademicRecordRequest
{
    [Required]
    public string AcademicYear { get; set; } = string.Empty;

    [Required]
    public string Semester { get; set; } = string.Empty;

    [Required]
    public string SubjectCode { get; set; } = string.Empty;

    [Required]
    public string SubjectName { get; set; } = string.Empty;

    public decimal? Units { get; set; }

    public decimal? Grade { get; set; }

    public string? Remarks { get; set; }
}
