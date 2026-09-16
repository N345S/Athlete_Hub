using System.ComponentModel.DataAnnotations;

namespace AthleteHub.API.DTOs;

public sealed class PerformanceRecordRequest
{
    [Required]
    public int AthleteId { get; set; }

    [Required]
    public int MetricId { get; set; }

    [Range(0, double.MaxValue)]
    public decimal RecordedValue { get; set; }

    public DateTime RecordedDate { get; set; } = DateTime.UtcNow.Date;
    public string? Notes { get; set; }
}

public sealed class TrainingSessionRequest
{
    [Required]
    public int TeamId { get; set; }

    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }
    public DateTime TrainingDate { get; set; }
    public TimeSpan? StartTime { get; set; }
    public TimeSpan? EndTime { get; set; }
    public string? Location { get; set; }
}

public sealed class TrainingApprovalRequest
{
    public string? RejectionReason { get; set; }
}

public sealed class AttendanceRequest
{
    [Required]
    public int AthleteId { get; set; }

    [Required, StringLength(30)]
    public string AttendanceStatus { get; set; } = string.Empty;

    public string? Remarks { get; set; }
}

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

    public DateTime? EndDate { get; set; }
    public TimeSpan? EndTime { get; set; }
    public string? Location { get; set; }
}
