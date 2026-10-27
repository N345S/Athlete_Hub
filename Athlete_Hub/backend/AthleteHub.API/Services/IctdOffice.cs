using AthleteHub.API.Data;
using AthleteHub.API.Models;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Services;

/// <summary>
/// A sign-in for the university's ICTD grades office, used to test what happens when a term ends. It opens its own
/// page (not a portal) where a term's final grades can be released before the scheduled release date, which sends
/// the coach evaluations at once, and taken back again to repeat the test. The role is never listed or offered to
/// the Sports Director (<see cref="HiddenRoles.Unlisted"/>), and the account is not in the demo account list.
/// </summary>
public static class IctdOffice
{
    public const string Role = "ICTD";
    public const string Email = "ictd.office@athlete.edu.ph";

    /// <summary>Creates the office account when it is missing. Run after any demo data reset, which deletes every account.</summary>
    public static async Task EnsureAccountAsync(AthleteHubDbContext context)
    {
        if (await context.Users.AnyAsync(user => user.Email == Email)) return;
        var roleId = await context.Roles.Where(role => role.RoleName == Role).Select(role => (int?)role.RoleId).FirstOrDefaultAsync();
        if (roleId == null) return;

        context.Users.Add(new User
        {
            RoleId = roleId.Value,
            Email = Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(DemoDataSeeder.Password),
            FirstName = "ICTD",
            LastName = "Grades Office",
            AccountStatus = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
    }
}
