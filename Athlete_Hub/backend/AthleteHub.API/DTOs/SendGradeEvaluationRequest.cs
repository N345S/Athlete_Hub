using System.ComponentModel.DataAnnotations;

namespace AthleteHub.API.DTOs;

public class SendGradeEvaluationRequest
{
    [Required]
    public int AthleteId { get; set; }

    [Required]
    public string AcademicYear { get; set; } = string.Empty;

    [Required]
    public string Semester { get; set; } = string.Empty;

    [Required]
    [MinLength(1)]
    public List<GradeEvaluationItem> Records { get; set; } = new();
}

public class GradeEvaluationItem
{
    [Required]
    public string SubjectCode { get; set; } = string.Empty;

    [Required]
    public string SubjectName { get; set; } = string.Empty;

    public decimal? Units { get; set; }

    public decimal? Grade { get; set; }

    public string? Remarks { get; set; }
}