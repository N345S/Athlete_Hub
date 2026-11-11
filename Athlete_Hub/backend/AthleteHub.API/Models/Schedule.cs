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

    // Qualification rules a team's lineup must meet for this event (all optional). See Controllers/LineupsController.cs.

    /// <summary>Only teams of this sport may submit a lineup; null means any sport.</summary>
    public int? LineupSportId { get; set; }

    public int? LineupMinPlayers { get; set; }

    public int? LineupMaxPlayers { get; set; }

    /// <summary>JSON array of document types every player must have on file, e.g. ["Medical Clearance"].</summary>
    public string? LineupRequiredDocuments { get; set; }

    /// <summary>League age limit: a player may be at most this old on the event date.</summary>
    public int? LineupMaxAge { get; set; }

    /// <summary>League limit on year level, e.g. 4 for players up to 4th year.</summary>
    public int? LineupMaxYearLevel { get; set; }

    public virtual Sport? LineupSport { get; set; }

    public virtual ICollection<EventLineup> Lineups { get; set; } = new List<EventLineup>();

    public virtual User? CreatedByNavigation { get; set; }
}
