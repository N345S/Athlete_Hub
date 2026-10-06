namespace AthleteHub.API.Services;

/// <summary>
/// Training dates and times are entered as local wall-clock values, so comparisons against "now"
/// must use the school's time zone rather than UTC.
/// </summary>
public class AppClock
{
    private readonly TimeZoneInfo _timeZone;

    public AppClock(IConfiguration configuration)
    {
        var timeZoneId = configuration["App:TimeZone"] ?? "Asia/Manila";
        try
        {
            _timeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            _timeZone = TimeZoneInfo.Local;
        }
    }

    public DateTime LocalNow => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _timeZone);

    public DateTime LocalToday => LocalNow.Date;
}
