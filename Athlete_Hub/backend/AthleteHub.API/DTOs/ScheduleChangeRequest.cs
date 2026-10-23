namespace AthleteHub.API.DTOs;

/// <summary>
/// Cancels or reschedules a training session, sports event, or competition. A reason is always required; a
/// reschedule also needs the new date and start time (the end time is optional).
/// </summary>
public sealed class ScheduleChangeRequest
{
    public const int MinReasonLength = 10;
    public const int MaxReasonLength = 500;

    public string? Reason { get; set; }

    public DateTime? Date { get; set; }

    public TimeSpan? StartTime { get; set; }

    public TimeSpan? EndTime { get; set; }

    /// <summary>The trimmed reason, or an error message for the person when it is missing or too short or long.</summary>
    public (string? Reason, string? Error) CheckReason(string action)
    {
        var reason = Reason?.Trim();
        if (string.IsNullOrEmpty(reason)) return (null, $"Please give the reason for the {action}. Everyone affected will see it.");
        if (reason.Length < MinReasonLength) return (null, $"Please explain the reason for the {action} more clearly (at least {MinReasonLength} characters).");
        if (reason.Length > MaxReasonLength) return (null, $"The reason is too long ({MaxReasonLength} characters at most).");
        return (reason, null);
    }
}
