using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class Schedule
{
    public int ScheduleId { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public string ScheduleType { get; set; } = null!;

    public DateTime StartDatetime { get; set; }

    public DateTime? EndDatetime { get; set; }

    public string? Location { get; set; }

    public int? CreatedBy { get; set; }

    /// <summary>Why the session or event was cancelled; it stays on calendars, marked cancelled.</summary>
    public string? CancellationReason { get; set; }

    public DateTime? CancelledAt { get; set; }

    /// <summary>Why the date or time last changed, shown with the item and sent to everyone affected.</summary>
    public string? RescheduleReason { get; set; }

    public DateTime? RescheduledAt { get; set; }

    public virtual User? CreatedByNavigation { get; set; }
}
