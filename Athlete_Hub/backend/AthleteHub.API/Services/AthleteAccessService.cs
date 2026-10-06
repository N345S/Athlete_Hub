using System.Security.Claims;
using AthleteHub.API.Data;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Services;

/// <summary>
/// Central rules for which signed-in users may see a given athlete's records.
/// </summary>
public class AthleteAccessService
{
    private readonly AthleteHubDbContext _context;

    public AthleteAccessService(AthleteHubDbContext context) => _context = context;

    public static int? GetUserId(ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null;

    /// <summary>
    /// Admins and directors see every athlete, registrars too when <paramref name="includeRegistrar"/> is set,
    /// athletes see only themselves, and coaches see active members of the teams they coach.
    /// </summary>
    public async Task<bool> CanViewAthleteAsync(ClaimsPrincipal user, int athleteId, bool includeRegistrar = true)
    {
        if (user.IsInRole("ADMIN") || user.IsInRole("DIRECTOR") || (includeRegistrar && user.IsInRole("REGISTRAR")))
        {
            return await _context.AthleteProfiles.AnyAsync(athlete => athlete.AthleteId == athleteId);
        }

        var userId = GetUserId(user);
        if (userId == null) return false;

        if (user.IsInRole("ATHLETE") || user.IsInRole("STUDENT"))
        {
            return await _context.AthleteProfiles.AnyAsync(athlete => athlete.AthleteId == athleteId && athlete.UserId == userId);
        }

        if (user.IsInRole("COACH"))
        {
            return await CoachHasAthleteAsync(userId.Value, athleteId);
        }

        return false;
    }

    /// <summary>
    /// True when the coach account (by user ID) actively coaches a team the athlete belongs to.
    /// </summary>
    public Task<bool> CoachHasAthleteAsync(int coachUserId, int athleteId) =>
        _context.TeamMembers.AnyAsync(member =>
            member.AthleteId == athleteId
            && member.DateLeft == null
            && member.Team.Coach != null
            && member.Team.Coach.UserId == coachUserId);
}
