using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using AthleteHub.API.Data;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

/// <summary>
/// Bulk account work from a CSV file the Sports Director uploads. The web page reads the file and sends its rows;
/// each endpoint first runs as a preview (<c>dryRun=true</c>, nothing saved) that reports every row's problems,
/// then for real, when it saves the rows without problems and skips the rest.
///
///   accounts  creates athlete, coach, director, and parent accounts, with an athlete's course, year level,
///             birth date, and teams, and a parent's children (existing athletes or athletes in the same file).
///   profiles  updates the profiles of existing student-athletes, found by University ID.
/// </summary>
[ApiController]
[Route("api/Accounts/import")]
[Authorize(Roles = "DIRECTOR,ADMIN", Policy = SensitiveAccess.Policy)]
public class AccountImportController : ControllerBase
{
    public const int MaxRows = 500;

    private static readonly string[] DateFormats = ["yyyy-MM-dd", "yyyy/MM/dd", "M/d/yyyy", "MM/dd/yyyy", "d-MMM-yyyy", "MMM d, yyyy", "MMMM d, yyyy"];
    private static readonly Regex PhonePattern = new(@"^[0-9+()\-\s]*$");
    // Several children, teams, etc. share one cell, separated by semicolons or vertical bars.
    private static readonly char[] ListSeparators = [';', '|'];
    private static readonly EmailAddressAttribute EmailCheck = new();

    // The role names people are likely to type, mapped to the stored role.
    private static readonly Dictionary<string, string> RoleAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["athlete"] = "ATHLETE", ["student"] = "ATHLETE", ["student-athlete"] = "ATHLETE", ["student athlete"] = "ATHLETE",
        ["coach"] = "COACH",
        ["director"] = "DIRECTOR", ["sports director"] = "DIRECTOR",
        ["parent"] = "PARENT", ["guardian"] = "PARENT",
    };

    private readonly AthleteHubDbContext _context;

    public AccountImportController(AthleteHubDbContext context)
    {
        _context = context;
    }

    // ==========================================
    // CREATE ACCOUNTS FROM A CSV FILE
    // POST: /api/Accounts/import/accounts?dryRun=true
    // ==========================================

    [HttpPost("accounts")]
    public async Task<IActionResult> ImportAccounts(ImportAccountsRequest request, [FromQuery] bool dryRun = true)
    {
        if (TooManyOrNone(request.Rows.Count) is { } problem) return problem;

        var roles = (await _context.Roles.ToListAsync())
            .Where(role => !HiddenRoles.IsUnlisted(role.RoleName))
            .ToDictionary(role => role.RoleName, role => role.RoleId);
        var teams = await ActiveTeamsAsync();

        var emails = request.Rows.Select(row => Clean(row.Email)?.ToLowerInvariant()).OfType<string>().Distinct().ToList();
        var universityIds = request.Rows.Select(row => CleanId(row.UniversityId)).OfType<string>().Distinct().ToList();
        var taken = await _context.Users
            .Where(u => emails.Contains(u.Email) || (u.UniversityId != null && universityIds.Contains(u.UniversityId)))
            .Select(u => new { u.Email, u.UniversityId })
            .ToListAsync();
        var takenEmails = taken.Select(u => u.Email.ToLowerInvariant()).ToHashSet();
        var takenIds = taken.Select(u => u.UniversityId).OfType<string>().ToHashSet(StringComparer.OrdinalIgnoreCase);

        var childIds = request.Rows.SelectMany(row => SplitList(row.Children)).Select(id => id.ToUpperInvariant()).Distinct().ToList();
        var existingAthletes = (await _context.AthleteProfiles
                .Where(profile => profile.User.UniversityId != null && childIds.Contains(profile.User.UniversityId))
                .Select(profile => new { profile.AthleteId, profile.User.UniversityId })
                .ToListAsync())
            .ToDictionary(row => row.UniversityId!, row => row.AthleteId, StringComparer.OrdinalIgnoreCase);

        // First pass: each row on its own, plus duplicates within the file.
        var seenEmails = new HashSet<string>();
        var seenIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var plans = request.Rows.Select(row =>
        {
            var plan = new AccountPlan { Line = row.Line };
            var errors = plan.Errors;

            var roleText = Clean(row.Role);
            if (roleText == null) errors.Add("Role is missing. Use Athlete, Coach, Director, or Parent.");
            else if (RoleAliases.TryGetValue(roleText, out var roleName) && roles.ContainsKey(roleName)) plan.Role = roleName;
            else errors.Add($"“{roleText}” is not a role. Use Athlete, Coach, Director, or Parent.");

            plan.FirstName = Clean(row.FirstName) ?? "";
            plan.LastName = Clean(row.LastName) ?? "";
            plan.MiddleName = Clean(row.MiddleName);
            if (plan.FirstName.Length == 0) errors.Add("First name is missing.");
            if (plan.LastName.Length == 0) errors.Add("Last name is missing.");

            plan.Email = Clean(row.Email)?.ToLowerInvariant() ?? "";
            if (plan.Email.Length == 0) errors.Add("Email is missing.");
            else if (!EmailCheck.IsValid(plan.Email)) errors.Add($"“{plan.Email}” is not an email address.");
            else if (takenEmails.Contains(plan.Email)) errors.Add("Someone already uses this email.");
            else if (!seenEmails.Add(plan.Email)) errors.Add("This email is used by another row in the file.");

            plan.UniversityId = plan.Role == "PARENT" ? null : CleanId(row.UniversityId);
            if (plan.Role is not null and not "PARENT")
            {
                if (plan.UniversityId == null) errors.Add("University ID is missing.");
                else if (takenIds.Contains(plan.UniversityId)) errors.Add("Someone already uses this University ID.");
                else if (!seenIds.Add(plan.UniversityId)) errors.Add("This University ID is used by another row in the file.");
            }

            plan.Phone = Clean(row.Phone);
            if (plan.Phone != null && (plan.Phone.Length > 30 || !PhonePattern.IsMatch(plan.Phone)))
                errors.Add("The phone number can only have numbers, spaces, and + ( ) -.");

            plan.Password = Clean(row.Password);
            if (plan.Password != null && plan.Password.Length < 8) errors.Add("The password must be at least 8 characters. Leave it blank to make one.");

            if (plan.Role == "ATHLETE")
            {
                ReadProfile(row.Course, row.YearLevel, row.BirthDate, errors, out plan.Course, out plan.YearLevel, out plan.BirthDate);
                plan.TeamIds = ReadTeams(row.Teams, teams, errors);
            }
            else if (plan.Role == "PARENT")
            {
                plan.ChildIds = SplitList(row.Children).Select(id => id.ToUpperInvariant()).Distinct().ToList();
                plan.Relationship = Clean(row.Relationship);
                if (plan.Relationship?.Length > 50) errors.Add("The relationship can be at most 50 characters.");
            }

            return plan;
        }).ToList();

        // Second pass: a parent's children may be existing athletes or athletes created by this file.
        var newAthleteIds = plans.Where(plan => plan.Role == "ATHLETE" && plan.Errors.Count == 0)
            .Select(plan => plan.UniversityId!).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var plan in plans.Where(plan => plan.Role == "PARENT"))
        {
            if (plan.ChildIds.Count == 0)
            {
                plan.Errors.Add("Add the University ID of at least one child, separated by semicolons (A24-31842; A26-35219).");
                continue;
            }

            var missing = plan.ChildIds.Where(id => !existingAthletes.ContainsKey(id) && !newAthleteIds.Contains(id)).ToList();
            if (missing.Count > 0)
                plan.Errors.Add($"No student-athlete has the University ID {string.Join(", ", missing)}, in the system or in a correct row of this file.");
        }

        var ready = plans.Where(plan => plan.Errors.Count == 0).ToList();
        if (!dryRun && ready.Count > 0)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            var athletesByUniversityId = new Dictionary<string, AthleteProfile>(StringComparer.OrdinalIgnoreCase);

            // Parents last, so their children from this file exist first.
            foreach (var plan in ready.OrderBy(plan => plan.Role == "PARENT"))
            {
                if (plan.Password == null)
                {
                    plan.Password = GeneratePassword();
                    plan.PasswordGenerated = true;
                }

                var user = new User
                {
                    RoleId = roles[plan.Role!],
                    UniversityId = plan.UniversityId,
                    Email = plan.Email,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(plan.Password),
                    FirstName = plan.FirstName,
                    MiddleName = plan.MiddleName,
                    LastName = plan.LastName,
                    Phone = plan.Phone,
                    AccountStatus = "ACTIVE",
                    CreatedAt = DateTime.UtcNow
                };
                _context.Users.Add(user);

                if (plan.Role == "ATHLETE")
                {
                    var profile = new AthleteProfile
                    {
                        User = user,
                        StudentNumber = plan.UniversityId!,
                        Course = plan.Course,
                        YearLevel = plan.YearLevel,
                        BirthDate = plan.BirthDate
                    };
                    _context.AthleteProfiles.Add(profile);
                    athletesByUniversityId[plan.UniversityId!] = profile;
                    _context.TeamMembers.AddRange(plan.TeamIds.Select(teamId => new TeamMember { TeamId = teamId, Athlete = profile, DateJoined = DateTime.UtcNow }));
                }
                else if (plan.Role == "COACH")
                {
                    _context.CoachProfiles.Add(new CoachProfile { User = user });
                }
                else if (plan.Role == "PARENT")
                {
                    foreach (var childId in plan.ChildIds)
                    {
                        var link = new ParentAthlete { ParentUser = user, Relationship = plan.Relationship, CreatedAt = DateTime.UtcNow };
                        if (athletesByUniversityId.TryGetValue(childId, out var newAthlete)) link.Athlete = newAthlete;
                        else link.AthleteId = existingAthletes[childId];
                        _context.ParentAthletes.Add(link);
                    }
                }
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }

        return Ok(new
        {
            dryRun,
            ready = ready.Count,
            created = dryRun ? 0 : ready.Count,
            rows = plans.Select(plan => new
            {
                line = plan.Line,
                status = plan.Errors.Count > 0 ? "ERROR" : dryRun ? "READY" : "CREATED",
                role = plan.Role,
                name = $"{plan.FirstName} {plan.LastName}".Trim(),
                email = plan.Email,
                universityId = plan.UniversityId,
                children = plan.ChildIds,
                errors = plan.Errors,
                passwordGenerated = plan.Errors.Count == 0 && (plan.PasswordGenerated || (dryRun && plan.Password == null)),
                // Only returned once, right after creating the account, so the director can hand it over.
                password = !dryRun && plan.PasswordGenerated ? plan.Password : null
            })
        });
    }

    // ==========================================
    // UPDATE STUDENT-ATHLETE PROFILES FROM A CSV FILE
    // POST: /api/Accounts/import/profiles?dryRun=true
    // ==========================================

    [HttpPost("profiles")]
    public async Task<IActionResult> ImportProfiles(ImportProfilesRequest request, [FromQuery] bool dryRun = true)
    {
        if (TooManyOrNone(request.Rows.Count) is { } problem) return problem;

        var teams = await ActiveTeamsAsync();
        var universityIds = request.Rows.Select(row => CleanId(row.UniversityId)).OfType<string>().Distinct().ToList();
        var athletes = (await _context.AthleteProfiles
                .Include(profile => profile.User)
                .Include(profile => profile.TeamMembers.Where(member => member.DateLeft == null))
                .Where(profile => profile.User.UniversityId != null && universityIds.Contains(profile.User.UniversityId))
                .ToListAsync())
            .ToDictionary(profile => profile.User.UniversityId!, StringComparer.OrdinalIgnoreCase);

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var results = new List<object>();
        var updated = 0;
        foreach (var row in request.Rows)
        {
            var errors = new List<string>();
            var changes = new List<string>();
            var universityId = CleanId(row.UniversityId);
            AthleteProfile? athlete = null;
            if (universityId == null) errors.Add("University ID is missing.");
            else if (!athletes.TryGetValue(universityId, out athlete)) errors.Add($"No student-athlete has the University ID {universityId}.");
            else if (!seen.Add(universityId)) errors.Add("This student-athlete is in another row of the file.");

            ReadProfile(row.Course, row.YearLevel, row.BirthDate, errors, out var course, out var yearLevel, out var birthDate);
            var teamIds = ReadTeams(row.Teams, teams, errors);
            var phone = Clean(row.Phone);
            if (phone != null && (phone.Length > 30 || !PhonePattern.IsMatch(phone)))
                errors.Add("The phone number can only have numbers, spaces, and + ( ) -.");

            // Blank cells keep what is already saved.
            if (errors.Count == 0 && athlete != null)
            {
                if (course != null && course != athlete.Course) { changes.Add($"Course: {course}"); if (!dryRun) athlete.Course = course; }
                if (yearLevel != null && yearLevel != athlete.YearLevel) { changes.Add($"Year level: {yearLevel}"); if (!dryRun) athlete.YearLevel = yearLevel; }
                if (birthDate != null && birthDate != athlete.BirthDate) { changes.Add($"Birth date: {birthDate:MMM d, yyyy}"); if (!dryRun) athlete.BirthDate = birthDate; }
                if (phone != null && phone != athlete.User.Phone) { changes.Add($"Phone: {phone}"); if (!dryRun) athlete.User.Phone = phone; }
                foreach (var teamId in teamIds.Where(teamId => athlete.TeamMembers.All(member => member.TeamId != teamId)))
                {
                    changes.Add($"Joins {teams[teamId]}");
                    if (!dryRun) _context.TeamMembers.Add(new TeamMember { TeamId = teamId, AthleteId = athlete.AthleteId, DateJoined = DateTime.UtcNow });
                }
                if (changes.Count > 0) updated++;
            }

            results.Add(new
            {
                line = row.Line,
                status = errors.Count > 0 ? "ERROR" : changes.Count == 0 ? "UNCHANGED" : dryRun ? "READY" : "UPDATED",
                universityId,
                name = athlete == null ? null : $"{athlete.User.FirstName} {athlete.User.LastName}",
                changes,
                errors
            });
        }

        if (!dryRun && updated > 0)
        {
            await _context.SaveChangesAsync();
        }

        return Ok(new { dryRun, ready = updated, updated = dryRun ? 0 : updated, rows = results });
    }

    private BadRequestObjectResult? TooManyOrNone(int count) => count switch
    {
        0 => BadRequest(new { message = "The file has no rows under the header." }),
        > MaxRows => BadRequest(new { message = $"The file has {count} rows. Please upload at most {MaxRows} at a time." }),
        _ => null
    };

    /// <summary>Active teams by ID, with their names.</summary>
    private async Task<Dictionary<int, string>> ActiveTeamsAsync() =>
        await _context.Teams.Where(team => team.Status == "ACTIVE").ToDictionaryAsync(team => team.TeamId, team => team.TeamName);

    /// <summary>Reads the athlete profile cells, adding a message to <paramref name="errors"/> for each bad one.</summary>
    private static void ReadProfile(string? courseText, string? yearText, string? birthText, List<string> errors,
        out string? course, out int? yearLevel, out DateTime? birthDate)
    {
        course = Clean(courseText);
        if (course?.Length > 150) errors.Add("The course can be at most 150 characters.");

        yearLevel = null;
        var year = Clean(yearText);
        if (year != null)
        {
            if (int.TryParse(year, out var level) && level is >= 1 and <= 6) yearLevel = level;
            else errors.Add("The year level must be a number from 1 to 6.");
        }

        birthDate = null;
        var birth = Clean(birthText);
        if (birth != null)
        {
            if (DateTime.TryParseExact(birth, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
                && date.Year > 1900 && date <= DateTime.UtcNow.Date)
                birthDate = DateTime.SpecifyKind(date, DateTimeKind.Unspecified);
            else errors.Add($"“{birth}” is not a birth date. Write it like 2005-03-14.");
        }
    }

    /// <summary>Matches team names (semicolon separated) to active teams.</summary>
    private static List<int> ReadTeams(string? text, Dictionary<int, string> teams, List<string> errors)
    {
        var ids = new List<int>();
        foreach (var name in SplitList(text))
        {
            var match = teams.FirstOrDefault(team => string.Equals(team.Value, name, StringComparison.OrdinalIgnoreCase));
            if (match.Value == null) errors.Add($"There is no active team called “{name}”.");
            else if (!ids.Contains(match.Key)) ids.Add(match.Key);
        }
        return ids;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? CleanId(string? value) => Clean(value)?.ToUpperInvariant();

    private static IEnumerable<string> SplitList(string? value) =>
        (value ?? "").Split(ListSeparators, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    /// <summary>A readable temporary password: two words, three digits, and a symbol.</summary>
    private static string GeneratePassword()
    {
        string[] words = ["Eagle", "Spike", "Court", "Sprint", "Relay", "Serve", "Medal", "Coach", "Score", "Pitch"];
        return $"{words[RandomNumberGenerator.GetInt32(words.Length)]}{words[RandomNumberGenerator.GetInt32(words.Length)]}{RandomNumberGenerator.GetInt32(100, 1000)}!";
    }

    private sealed class AccountPlan
    {
        public int Line;
        public string? Role;
        public string FirstName = "";
        public string? MiddleName;
        public string LastName = "";
        public string Email = "";
        public string? UniversityId;
        public string? Phone;
        public string? Password;
        public bool PasswordGenerated;
        public string? Course;
        public int? YearLevel;
        public DateTime? BirthDate;
        public List<int> TeamIds = [];
        public List<string> ChildIds = [];
        public string? Relationship;
        public List<string> Errors { get; } = [];
    }
}

/// <summary>One CSV row; <see cref="Line"/> is its line number in the file, for messages.</summary>
public sealed class ImportAccountRow
{
    public int Line { get; set; }
    public string? Role { get; set; }
    public string? FirstName { get; set; }
    public string? MiddleName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public string? UniversityId { get; set; }
    public string? Phone { get; set; }
    public string? Password { get; set; }
    public string? Course { get; set; }
    public string? YearLevel { get; set; }
    public string? BirthDate { get; set; }
    public string? Teams { get; set; }
    public string? Children { get; set; }
    public string? Relationship { get; set; }
}

public sealed class ImportAccountsRequest
{
    public List<ImportAccountRow> Rows { get; set; } = [];
}

public sealed class ImportProfileRow
{
    public int Line { get; set; }
    public string? UniversityId { get; set; }
    public string? Course { get; set; }
    public string? YearLevel { get; set; }
    public string? BirthDate { get; set; }
    public string? Phone { get; set; }
    public string? Teams { get; set; }
}

public sealed class ImportProfilesRequest
{
    public List<ImportProfileRow> Rows { get; set; } = [];
}
