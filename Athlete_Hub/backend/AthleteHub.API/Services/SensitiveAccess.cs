using System.Security.Claims;

namespace AthleteHub.API.Services;

/// <summary>
/// Grades and accounts are confidential, so the Sports Director opens them with a separate password that they set
/// up the first time (POST /api/Auth/confidential-password, then POST /api/Auth/unlock). Both return a short-lived
/// token carrying <see cref="ClaimType"/>; endpoints with <see cref="Policy"/> refuse a director's ordinary sign-in
/// token.
/// </summary>
public static class SensitiveAccess
{
    public const string Policy = "SensitiveAccess";

    public const string ClaimType = "SensitiveAccess";

    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);

    /// <summary>Only the director needs to unlock; the hidden Admin role keeps the access it had.</summary>
    public static bool IsSatisfied(ClaimsPrincipal user) =>
        !user.IsInRole("DIRECTOR") || user.HasClaim(ClaimType, "true");
}
