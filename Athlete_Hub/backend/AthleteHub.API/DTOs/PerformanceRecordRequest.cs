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

    // New fields for universal performance tracking
    public string DataType { get; set; } = "PUSH_UP";

    public string Unit { get; set; } = "NUMBER";

    public int SessionId { get; set; }
}