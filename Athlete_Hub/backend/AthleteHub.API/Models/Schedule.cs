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

    public virtual User? CreatedByNavigation { get; set; }
}
