using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class Attendance
{
    public int AttendanceId { get; set; }

    public int TrainingSessionId { get; set; }

    public int AthleteId { get; set; }

    public string AttendanceStatus { get; set; } = null!;

    public string? Remarks { get; set; }

    public virtual AthleteProfile Athlete { get; set; } = null!;

    public virtual TrainingSession TrainingSession { get; set; } = null!;
}
