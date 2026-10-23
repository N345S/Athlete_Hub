namespace AthleteHub.API.Services;

/// <summary>
/// Checks the ICTD university database for newly released grades when the API starts and then every
/// Ictd:SyncIntervalMinutes (60 by default), and pulls them with <see cref="IctdGradeSync"/>.
/// </summary>
public class IctdGradeSyncWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<IctdGradeSyncWorker> _logger;

    public IctdGradeSyncWorker(IServiceScopeFactory scopes, ILogger<IctdGradeSyncWorker> logger, IConfiguration configuration)
    {
        _scopes = scopes;
        _logger = logger;
        Interval = TimeSpan.FromMinutes(Math.Max(1, configuration.GetValue("Ictd:SyncIntervalMinutes", 60)));
    }

    public TimeSpan Interval { get; }

    /// <summary>When the last check finished (UTC), or null before the first one.</summary>
    public DateTime? LastCheckedAt { get; private set; }

    public DateTime? NextCheckAt { get; private set; }

    public bool LastCheckFailed { get; private set; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            await CheckAsync(stoppingToken);
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task CheckAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopes.CreateScope();
            var pulled = await scope.ServiceProvider.GetRequiredService<IctdGradeSync>().SyncAsync(stoppingToken);
            if (pulled > 0) _logger.LogInformation("Pulled released ICTD grades for {Count} student-athletes.", pulled);
            LastCheckFailed = false;
        }
        catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
        {
            // The next check tries again; one failure must not stop the schedule.
            _logger.LogError(ex, "Could not pull grades from the ICTD university database.");
            LastCheckFailed = true;
        }
        LastCheckedAt = DateTime.UtcNow;
        NextCheckAt = LastCheckedAt + Interval;
    }
}
