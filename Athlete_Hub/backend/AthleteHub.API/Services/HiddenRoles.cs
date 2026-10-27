namespace AthleteHub.API.Services;

/// <summary>
/// Roles that are switched off but kept: their accounts, records, controllers, and portals stay in place.
/// Nobody can sign in with a hidden role, existing sessions stop working, and the Sports Director cannot
/// create or list accounts with one. To bring a role back, remove it from <see cref="Names"/> (and turn the
/// matching flag back on in web/src/lib/features.js).
/// </summary>
public static class HiddenRoles
{
    /// <summary>
    /// REGISTRAR: Grade Evaluations and eligibility decisions are replaced by grades pulled from the ICTD
    /// university database. ADMIN: the Sports Director now creates and manages accounts.
    /// </summary>
    public static readonly string[] Names = ["REGISTRAR", "ADMIN"];

    public static bool Contains(string? roleName) =>
        roleName != null && Names.Contains(roleName, StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Roles kept out of every account list and role picker: the hidden roles plus the ICTD grades office, which
    /// can sign in but is not an account the Sports Director manages (see <see cref="IctdOffice"/>).
    /// </summary>
    public static readonly string[] Unlisted = [.. Names, IctdOffice.Role];

    public static bool IsUnlisted(string? roleName) =>
        roleName != null && Unlisted.Contains(roleName, StringComparer.OrdinalIgnoreCase);
}
