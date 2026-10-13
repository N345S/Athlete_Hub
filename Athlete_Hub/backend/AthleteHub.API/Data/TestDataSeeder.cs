using System.Text;
using System.Text.Json;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Data;

/// <summary>
/// Development-only test data: 126 sign-in-ready accounts (1 director, 5 admins, 5 registrars, 12 coaches,
/// 99 athletes, 4 parents) spread across ten teams, covering active, suspended, inactive, quit, transferred,
/// unassigned, and multi-sport athletes, every eligibility outcome, approval workflows in each state, and
/// parents linked to one child, to two children, or to none.
///
///   dotnet run -- --seed-test-data     (re-creates everything; earlier seed data is removed first)
///   dotnet run -- --remove-test-data   (deletes only seed data)
///   dotnet run -- --seed-parents       (adds only the missing parent accounts; nothing is removed)
///
/// Seed rows are identifiable by the @seed.athletehub.test email domain and the "[Seed]" title prefix,
/// so removal never touches real records. Every account uses the password <see cref="Password"/>, and the
/// full account list is written to database/TEST_ACCOUNTS.md each time the data is seeded.
/// </summary>
public class TestDataSeeder
{
    public const string Password = "Seed123!";
    private const string EmailDomain = "@seed.athletehub.test";
    private const string Prefix = "[Seed] ";
    private const string FilePrefix = "seed-";
    private const int GeneratedAthleteCount = 69;

    private static readonly string[] FirstNames =
    [
        "Andrea", "Benjo", "Camille", "Diego", "Erika", "Francis", "Gabriel", "Hannah", "Isabel", "Joaquin",
        "Katrina", "Luis", "Marielle", "Nathan", "Olivia", "Patrick", "Queenie", "Rafael", "Samantha", "Tristan",
        "Ursula", "Vincent", "Wendy", "Xander", "Yvonne", "Zach", "Bianca", "Carlo", "Denise", "Emilio",
        "Frances", "Gino", "Hazel", "Ivan", "Janelle", "Kyle", "Lea", "Marco", "Nina", "Oscar"
    ];

    private static readonly string[] LastNames =
    [
        "Abad", "Bernardo", "Castillo", "Dimaculangan", "Estrada", "Fajardo", "Gutierrez", "Hernandez", "Ilagan", "Jimenez",
        "Katigbak", "Lacsamana", "Macaraeg", "Navarro", "Ocampo", "Panganiban", "Quiambao", "Robles", "Salonga", "Tolentino",
        "Umali", "Valdez", "Yulo", "Zamora", "Agustin", "Buenaventura", "Cortez", "De Leon", "Evangelista", "Francisco"
    ];

    private static readonly string[] Courses =
    [
        "BS Computer Science", "BS Information Technology", "BS Accountancy", "BS Nursing", "BS Psychology",
        "BS Civil Engineering", "BA Communication", "BS Biology", "BS Education", "BS Architecture",
        "BS Business Administration", "BS Hospitality Management"
    ];

    private static readonly string[] IneligibleReasons = ["Failing Grades", "Academic Requirement Not Met", "Incomplete Academic Requirement"];

    // Parent accounts and the seed athletes they are linked to (by the child's email name).
    // Shared by --seed-test-data and --seed-parents so both create the same accounts.
    private static readonly (string FirstName, string LastName, (string Child, string Relationship)[] Children, string Scenario)[] ParentPlans =
    [
        ("Rosario", "Dela Cruz", [("juan.delacruz", "Mother")], "Parent of the model athlete — good attendance, upcoming practice"),
        ("Teresa", "Flores", [("jasmine.flores", "Mother")], "Parent of a low-attendance athlete (17%)"),
        ("Roberto", "Aquino", [("kevin.aquino", "Father"), ("daniel.ramos", "Guardian")], "Two linked children on different teams — switch between them on Training sessions"),
        ("Nora", "Lim", [], "No children linked yet — empty state; admin can link Bea Lim (SEED-A-008)"),
    ];

    private readonly AthleteHubDbContext _context;
    private readonly string _contentRoot;
    private readonly DateTime _today;
    private readonly string _passwordHash = BCrypt.Net.BCrypt.HashPassword(Password);
    private readonly Random _random = new(2026);
    private readonly List<AccountRow> _accounts = [];
    private readonly HashSet<string> _usedEmails = new(StringComparer.OrdinalIgnoreCase);

    private Dictionary<string, int> _roles = [];
    private User _director = null!;
    private User _registrar = null!;
    private AcademicTerm _firstSem = null!;
    private AcademicTerm _secondSem = null!;

    private sealed record AccountRow(string Role, string Name, string Email, string Status, string Team, string Scenario);

    /// <summary>A team plus the data generated for it.</summary>
    private sealed class TeamPlan
    {
        public required Team Team { get; init; }
        public required CoachProfile Coach { get; init; }
        public required PerformanceMetricDefinition Metric { get; init; }
        public required string Workout { get; init; }
        public required string Unit { get; init; }
        public required decimal BaseValue { get; init; }
        public required decimal Step { get; init; }
        public List<TrainingSession> PastSessions { get; } = [];
    }

    public TestDataSeeder(AthleteHubDbContext context, AppClock clock, IWebHostEnvironment environment)
    {
        _context = context;
        _contentRoot = environment.ContentRootPath;
        _today = clock.LocalToday;
    }

    public async Task RemoveAsync()
    {
        var userIds = await _context.Users.Where(user => user.Email.EndsWith(EmailDomain) || EasyEmails.Contains(user.Email)).Select(user => user.UserId).ToListAsync();
        var athleteIds = await _context.AthleteProfiles.Where(athlete => userIds.Contains(athlete.UserId)).Select(athlete => athlete.AthleteId).ToListAsync();
        var coachIds = await _context.CoachProfiles.Where(coach => userIds.Contains(coach.UserId)).Select(coach => coach.CoachId).ToListAsync();
        var teamIds = await _context.Teams.Where(team => team.TeamName.StartsWith(Prefix)).Select(team => team.TeamId).ToListAsync();
        var sessionIds = await _context.TrainingSessions.Where(session => teamIds.Contains(session.TeamId) || coachIds.Contains(session.CoachId)).Select(session => session.TrainingSessionId).ToListAsync();

        // Real records may point at seed staff (e.g. a seed registrar reviewed a real athlete); detach those first.
        int? none = null;
        await _context.Achievements.Where(item => item.VerifiedBy != null && userIds.Contains(item.VerifiedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.VerifiedBy, none));
        await _context.PortfolioItems.Where(item => item.VerifiedBy != null && userIds.Contains(item.VerifiedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.VerifiedBy, none));
        await _context.EligibilityRecords.Where(item => item.RequestedBy != null && userIds.Contains(item.RequestedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.RequestedBy, none));
        await _context.EligibilityRecords.Where(item => item.UploadedBy != null && userIds.Contains(item.UploadedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.UploadedBy, none));
        await _context.EligibilityRecords.Where(item => item.ReviewedBy != null && userIds.Contains(item.ReviewedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.ReviewedBy, none));
        await _context.TrainingSessions.Where(item => item.ReviewedBy != null && userIds.Contains(item.ReviewedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.ReviewedBy, none));
        await _context.Schedules.Where(item => item.CreatedBy != null && userIds.Contains(item.CreatedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.CreatedBy, none));
        await _context.PerformanceRecords.Where(item => item.CoachId != null && coachIds.Contains(item.CoachId.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.CoachId, none));
        await _context.AcademicImportBatches.Where(item => item.ImportedBy != null && userIds.Contains(item.ImportedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.ImportedBy, none));

        // Delete children before parents; each step only matches rows owned by seed users or seed teams.
        await _context.Attendances.Where(item => athleteIds.Contains(item.AthleteId) || sessionIds.Contains(item.TrainingSessionId)).ExecuteDeleteAsync();
        await _context.PerformanceRecords.Where(item => athleteIds.Contains(item.AthleteId) || (item.SessionId != null && sessionIds.Contains(item.SessionId.Value))).ExecuteDeleteAsync();
        await _context.EligibilityRecords.Where(item => athleteIds.Contains(item.AthleteId)).ExecuteDeleteAsync();
        await _context.AcademicRecords.Where(item => athleteIds.Contains(item.AthleteId)).ExecuteDeleteAsync();
        await _context.PortfolioItems.Where(item => athleteIds.Contains(item.AthleteId)).ExecuteDeleteAsync();
        await _context.Documents.Where(item => athleteIds.Contains(item.AthleteId)).ExecuteDeleteAsync();
        await _context.Achievements.Where(item => athleteIds.Contains(item.AthleteId)).ExecuteDeleteAsync();
        await _context.TrainingSessions.Where(item => sessionIds.Contains(item.TrainingSessionId)).ExecuteDeleteAsync();
        await _context.TeamMembers.Where(item => athleteIds.Contains(item.AthleteId) || teamIds.Contains(item.TeamId)).ExecuteDeleteAsync();
        await _context.ParentAthletes.Where(item => userIds.Contains(item.ParentUserId) || athleteIds.Contains(item.AthleteId)).ExecuteDeleteAsync();
        await _context.Teams.Where(item => teamIds.Contains(item.TeamId)).ExecuteDeleteAsync();
        await _context.Teams.Where(item => item.CoachId != null && coachIds.Contains(item.CoachId.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.CoachId, none));
        await _context.Schedules.Where(item => item.Title.StartsWith(Prefix)).ExecuteDeleteAsync();
        await _context.Announcements.Where(item => userIds.Contains(item.CreatedBy)).ExecuteDeleteAsync();
        await _context.Notifications.Where(item => userIds.Contains(item.UserId) || item.Title.StartsWith(Prefix)).ExecuteDeleteAsync();
        await _context.AthleteProfiles.Where(item => athleteIds.Contains(item.AthleteId)).ExecuteDeleteAsync();
        await _context.CoachProfiles.Where(item => coachIds.Contains(item.CoachId)).ExecuteDeleteAsync();
        await _context.Users.Where(item => userIds.Contains(item.UserId)).ExecuteDeleteAsync();

        foreach (var folder in new[] { "documents", "grade-evaluations" })
        {
            var directory = Path.Combine(_contentRoot, "private-uploads", folder);
            if (!Directory.Exists(directory)) continue;
            foreach (var file in Directory.EnumerateFiles(directory, FilePrefix + "*")) File.Delete(file);
        }

        Console.WriteLine($"Removed seed data: {userIds.Count} users, {teamIds.Count} teams, {sessionIds.Count} training sessions.");
    }

    public Task<bool> HasSeedDataAsync() => _context.Users.AnyAsync(user => user.Email.EndsWith(EmailDomain));

    public async Task SeedAsync()
    {
        await RemoveAsync();
        await using var transaction = await _context.Database.BeginTransactionAsync();

        _roles = await _context.Roles.ToDictionaryAsync(role => role.RoleName, role => role.RoleId);
        _firstSem = await GetOrCreateTermAsync("2026-2027", "1st Semester");
        _secondSem = await GetOrCreateTermAsync("2026-2027", "2nd Semester");

        // ---------------- Staff: 1 director, 5 admins, 5 registrars ----------------
        _director = await CreateStaffAsync("DIRECTOR", "SEED-D-001", "Elena", "Navarro", "ACTIVE", "Sports Director — approves training, assigns athletes");

        await CreateStaffAsync("ADMIN", "SEED-ADM-001", "Victor", "Lopez", "ACTIVE", "Administrator — manages accounts");
        await CreateStaffAsync("ADMIN", "SEED-ADM-002", "Carmen", "Dizon", "ACTIVE", "Administrator");
        await CreateStaffAsync("ADMIN", "SEED-ADM-003", "Oscar", "Salazar", "ACTIVE", "Administrator");
        await CreateStaffAsync("ADMIN", "SEED-ADM-004", "Irene", "Manalo", "ACTIVE", "Administrator");
        await CreateStaffAsync("ADMIN", "SEED-ADM-005", "Felix", "Ong", "INACTIVE", "Inactive administrator — sign-in is refused");

        _registrar = await CreateStaffAsync("REGISTRAR", "SEED-R-001", "Grace", "Tan", "ACTIVE", "Registrar — uploaded and decided most evaluations");
        await CreateStaffAsync("REGISTRAR", "SEED-R-002", "Rosa", "Velasco", "ACTIVE", "Registrar");
        await CreateStaffAsync("REGISTRAR", "SEED-R-003", "Edwin", "Pascual", "ACTIVE", "Registrar");
        await CreateStaffAsync("REGISTRAR", "SEED-R-004", "Lyn", "Domingo", "ACTIVE", "Registrar");
        await CreateStaffAsync("REGISTRAR", "SEED-R-005", "Noel", "Castro", "SUSPENDED", "Suspended registrar — sign-in is refused");

        // ---------------- Coaches and teams ----------------
        var santos = await CreateCoachAsync("SEED-C-001", "Maria", "Santos", "ACTIVE", "Basketball");
        var cruz = await CreateCoachAsync("SEED-C-002", "Ramon", "Cruz", "ACTIVE", "Volleyball");
        var gonzales = await CreateCoachAsync("SEED-C-003", "Arnel", "Gonzales", "ACTIVE", "Football");
        var ramirez = await CreateCoachAsync("SEED-C-004", "Joy", "Ramirez", "ACTIVE", "Badminton");
        var yap = await CreateCoachAsync("SEED-C-005", "Dennis", "Yap", "ACTIVE", "Table Tennis");
        var lacson = await CreateCoachAsync("SEED-C-006", "Cris", "Lacson", "ACTIVE", "Taekwondo");
        var soriano = await CreateCoachAsync("SEED-C-007", "Rhea", "Soriano", "ACTIVE", "Swimming");
        var alvarez = await CreateCoachAsync("SEED-C-008", "Ben", "Alvarez", "SUSPENDED", "Futsal");
        var reyesCoach = await CreateCoachAsync("SEED-C-009", "Paolo", "Reyes", "INACTIVE", "Swimming");
        var mendoza = await CreateCoachAsync("SEED-C-010", "Liza", "Mendoza", "ACTIVE", "Track and Field");

        var eagles = await PlanTeamAsync("Basketball", "TEAM", santos, "Blue Eagles Basketball", "Vertical Jump", "NUMBER", 45, 1.2m);
        var spikers = await PlanTeamAsync("Volleyball", "TEAM", cruz, "Lady Spikers Volleyball", "Serve Accuracy", "PERCENT", 62, 2.5m);
        var strikers = await PlanTeamAsync("Football", "TEAM", gonzales, "Strikers Football", "Sprint 30m", "SECONDS", 4.9m, -0.05m);
        var shuttlers = await PlanTeamAsync("Badminton", "INDIVIDUAL", ramirez, "Shuttle Kings Badminton", "Smash Speed", "NUMBER", 180, 3m);
        var paddlers = await PlanTeamAsync("Table Tennis", "INDIVIDUAL", yap, "Paddlers Table Tennis", "Rally Consistency", "NUMBER", 30, 2m);
        var kickers = await PlanTeamAsync("Taekwondo", "INDIVIDUAL", lacson, "Black Belts Taekwondo", "Kicks per Minute", "NUMBER", 55, 1.5m);
        var dolphins = await PlanTeamAsync("Swimming", "INDIVIDUAL", soriano, "Dolphins Swimming", "50m Freestyle", "SECONDS", 31, -0.3m);
        var thunder = await PlanTeamAsync("Futsal", "TEAM", alvarez, "Thunder Futsal", "Passing Accuracy", "PERCENT", 70, 1m);
        var sharks = await PlanTeamAsync("Swimming", "INDIVIDUAL", reyesCoach, "Sharks Swimming", "50m Freestyle", "SECONDS", 33, -0.2m, active: false);
        var activeTeams = new[] { eagles, spikers, strikers, shuttlers, paddlers, kickers, dolphins, thunder };
        _accounts.Add(new AccountRow("COACH", "Liza Mendoza", mendoza.User.Email, "ACTIVE", "—", "Active coach with no team; assigning athletes to her is refused"));

        foreach (var (plan, index) in activeTeams.Select((plan, index) => (plan, index)))
        {
            for (var week = 6; week >= 1; week--)
            {
                plan.PastSessions.Add(AddSession(plan, $"Training — week {7 - week}", _today.AddDays(-7 * week + index % 3), "APPROVED"));
            }
            // A suspended coach's team has no future sessions.
            if (plan == thunder) continue;
            AddSession(plan, "Team practice", _today.AddDays(2 + index % 4), "APPROVED");
            if (index % 2 == 0) AddSession(plan, "Extra conditioning (awaiting approval)", _today.AddDays(5 + index % 3), "PENDING");
        }
        AddSession(eagles, "Late-night practice (rejected)", _today.AddDays(4), "REJECTED", "Gym is closed after 9 PM.");
        AddSession(sharks, "Lap swim (old team)", _today.AddMonths(-13), "APPROVED");
        await _context.SaveChangesAsync();

        // ---------------- Hand-made scenario athletes ----------------
        await SeedScenarioAthletesAsync(eagles, spikers, sharks);

        // ---------------- Generated athletes, spread evenly across the active teams ----------------
        await SeedGeneratedAthletesAsync(activeTeams);

        // ---------------- Easy-to-type accounts for hands-on testing ----------------
        await CreateEasyAccountsAsync();

        // ---------------- Schedules ----------------
        _context.Schedules.AddRange(
            new Schedule { Title = Prefix + "UAAP Basketball Opener", ScheduleType = "COMPETITION", StartDatetime = _today.AddDays(9).AddHours(15), EndDatetime = _today.AddDays(9).AddHours(18), Location = "Main Arena", CreatedBy = _director.UserId, Description = "Season opener against a rival school." },
            new Schedule { Title = Prefix + "Intramurals Finals Day", ScheduleType = "SPORTS_EVENT", StartDatetime = _today.AddDays(12).AddHours(9), EndDatetime = _today.AddDays(12).AddHours(17), Location = "University Grounds", CreatedBy = _director.UserId },
            new Schedule { Title = Prefix + "Regional Swimming Meet", ScheduleType = "COMPETITION", StartDatetime = _today.AddDays(20).AddHours(7), EndDatetime = _today.AddDays(20).AddHours(15), Location = "City Aquatic Center", CreatedBy = _director.UserId },
            new Schedule { Title = Prefix + "Athletes' medical screening", ScheduleType = "SPORTS_EVENT", StartDatetime = _today.AddDays(-3).AddHours(8), EndDatetime = _today.AddDays(-3).AddHours(12), Location = "University Clinic", CreatedBy = _director.UserId });

        // ---------------- Staff notifications ----------------
        Notify(_director.UserId, "Training session approval requested", "Several coaches submitted sessions that are waiting for your approval.", "TRAINING_APPROVAL_REQUEST");
        Notify(_registrar.UserId, "Grade evaluation requested", "New Grade Evaluation requests are waiting for an official PDF.", "GRADE_EVALUATION_REQUEST");
        Notify(santos.UserId, "Training session rejected", "Late-night practice was rejected. Reason: Gym is closed after 9 PM.", "TRAINING_REJECTED");

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        var tablePath = WriteAccountTable();
        Console.WriteLine($"Seeded {_accounts.Count} accounts (password for every account: {Password}).");
        foreach (var group in _accounts.GroupBy(row => row.Role)) Console.WriteLine($"  {group.Key,-10} {group.Count()}");
        Console.WriteLine($"Account list written to {tablePath}");
    }

    // ------------------------------------------------------------------ scenarios

    private async Task SeedScenarioAthletesAsync(TeamPlan eagles, TeamPlan spikers, TeamPlan sharks)
    {
        var juan = await CreateAthleteAsync("SEED-A-001", "Juan", "Dela Cruz", "ACTIVE", "BS Computer Science", 3);
        var ana = await CreateAthleteAsync("SEED-A-002", "Ana", "Reyes", "ACTIVE", "BS Accountancy", 2);
        var mark = await CreateAthleteAsync("SEED-A-003", "Mark", "Villanueva", "ACTIVE", "BS Civil Engineering", 1);
        var carla = await CreateAthleteAsync("SEED-A-004", "Carla", "Bautista", "SUSPENDED", "BS Nursing", 2);
        var miguel = await CreateAthleteAsync("SEED-A-005", "Miguel", "Torres", "INACTIVE", "BS Psychology", 4);
        var sofia = await CreateAthleteAsync("SEED-A-006", "Sofia", "Garcia", "ACTIVE", "BA Communication", 3);
        var daniel = await CreateAthleteAsync("SEED-A-007", "Daniel", "Ramos", "ACTIVE", "BS Architecture", 2);
        var bea = await CreateAthleteAsync("SEED-A-008", "Bea", "Lim", "ACTIVE", "BS Biology", 1);
        var kevin = await CreateAthleteAsync("SEED-A-009", "Kevin", "Aquino", "ACTIVE", "BS Information Technology", 3);
        var jasmine = await CreateAthleteAsync("SEED-A-010", "Jasmine", "Flores", "ACTIVE", "BS Education", 4);

        AddMember(eagles, juan, _today.AddMonths(-8));
        AddMember(eagles, mark, _today.AddMonths(-2));
        AddMember(eagles, carla, _today.AddMonths(-6));
        AddMember(eagles, miguel, _today.AddMonths(-14), left: _today.AddMonths(-1));
        AddMember(eagles, daniel, _today.AddMonths(-1));
        AddMember(eagles, kevin, _today.AddMonths(-5));
        AddMember(spikers, ana, _today.AddMonths(-7));
        AddMember(spikers, sofia, _today.AddMonths(-10), left: _today.AddDays(-20));
        AddMember(spikers, daniel, _today.AddMonths(-9), left: _today.AddMonths(-1).AddDays(-1));
        AddMember(spikers, kevin, _today.AddMonths(-4));
        AddMember(spikers, jasmine, _today.AddMonths(-11));
        AddMember(sharks, miguel, _today.AddMonths(-20), left: _today.AddMonths(-12));
        await _context.SaveChangesAsync();

        var eaglesPast = eagles.PastSessions;
        var spikersPast = spikers.PastSessions;
        MarkAttendance(eaglesPast, juan, ["PRESENT", "PRESENT", "PRESENT", "LATE", "PRESENT", "PRESENT"]);
        MarkAttendance(eaglesPast, kevin, ["PRESENT", "LATE", "PRESENT", "PRESENT", "ABSENT", "PRESENT"]);
        MarkAttendance(eaglesPast, carla, ["PRESENT", "PRESENT", "ABSENT", "ABSENT", "ABSENT", "ABSENT"]);
        MarkAttendance(eaglesPast.Take(5).ToList(), miguel, ["PRESENT", "PRESENT", "LATE", "PRESENT", "PRESENT"]);
        MarkAttendance(eaglesPast.Take(2).ToList(), mark, ["PRESENT", "PRESENT"]);
        MarkAttendance(eaglesPast.Skip(4).ToList(), daniel, ["PRESENT", "PRESENT"]);
        MarkAttendance(spikersPast, ana, ["PRESENT", "LATE", "PRESENT", "PRESENT", "PRESENT", "LATE"]);
        MarkAttendance(spikersPast, jasmine, ["ABSENT", "PRESENT", "ABSENT", "ABSENT", "EXCUSED", "ABSENT"]);
        MarkAttendance(spikersPast.Take(4).ToList(), sofia, ["PRESENT", "PRESENT", "LATE", "ABSENT"]);
        MarkAttendance(spikersPast.Take(3).ToList(), daniel, ["PRESENT", "ABSENT", "PRESENT"]);
        MarkAttendance(spikersPast, kevin, ["PRESENT", "PRESENT", "PRESENT", "PRESENT", "LATE", "PRESENT"]);

        AddPerformance(juan, eagles, eaglesPast, [48, 50, 51, 53, 54, 56]);
        AddPerformance(juan, eagles, eaglesPast, [3.6m, 3.55m, 3.5m, 3.48m, 3.4m, 3.38m], "Sprint 20m", "SECONDS");
        AddPerformance(kevin, eagles, eaglesPast, [44, 45, 45, 46, 45, 47]);
        AddPerformance(carla, eagles, eaglesPast.Take(2).ToList(), [40, 41]);
        AddPerformance(ana, spikers, spikersPast, [62, 65, 70, 68, 74, 78]);
        AddPerformance(jasmine, spikers, spikersPast.Take(2).ToList(), [55, 51]);
        AddPerformance(sofia, spikers, spikersPast.Take(3).ToList(), [80, 76, 71]);
        await _context.SaveChangesAsync();

        await AddEligibilityAsync(juan, _firstSem, "ELIGIBLE", [], "Good standing.", 120, requestedBy: eagles.Coach);
        await AddEligibilityAsync(juan, _secondSem, "ELIGIBLE", [], null, 10, requestedBy: eagles.Coach);
        await AddEligibilityAsync(ana, _secondSem, "INELIGIBLE", ["Failing Grades"], "Two failing grades in major subjects; may re-apply next term.", 8, requestedBy: spikers.Coach);
        await AddEligibilityAsync(mark, _secondSem, "PENDING", [], null, 3, withPdf: false, requestedBy: eagles.Coach);
        await AddEligibilityAsync(kevin, _secondSem, "PENDING", [], null, 4, requestedBy: eagles.Coach);
        await AddEligibilityAsync(carla, _firstSem, "INELIGIBLE", ["Incomplete Academic Requirement", "Other"], "Incomplete requirements; account suspended pending review.", 100, requestedBy: eagles.Coach);
        await AddEligibilityAsync(miguel, _firstSem, "ELIGIBLE", [], "Final term before leaving the university.", 130, requestedBy: eagles.Coach);
        await AddEligibilityAsync(sofia, _firstSem, "ELIGIBLE", [], null, 125, requestedBy: spikers.Coach);
        await AddEligibilityAsync(jasmine, _firstSem, "INELIGIBLE", ["Academic Requirement Not Met"], "Below required units.", 118, requestedBy: spikers.Coach);
        await AddEligibilityAsync(jasmine, _secondSem, "ELIGIBLE", [], "Requirement completed; eligibility restored.", 6, requestedBy: spikers.Coach);
        await AddEligibilityAsync(daniel, _secondSem, "ELIGIBLE", [], null, 15, requestedBy: eagles.Coach);

        await AddAchievementAsync(juan, "Regional Basketball Championship — 1st place", "Competition", -60, "VERIFIED", eagles.Coach);
        await AddAchievementAsync(juan, "Team captain, 2026-2027", "Leadership", -30, "PENDING", null);
        await AddAchievementAsync(ana, "Inter-school volleyball tournament MVP", "Award", -45, "REJECTED", spikers.Coach, "Certificate is unreadable; please upload a clearer copy.");
        await AddAchievementAsync(mark, "City youth league rookie of the year", "Award", -15, "PENDING", null);
        await AddAchievementAsync(sofia, "PRISAA volleyball qualifier", "Competition", -90, "VERIFIED", spikers.Coach);
        await AddAchievementAsync(miguel, "Varsity athlete of the year 2025", "Award", -300, "VERIFIED", eagles.Coach);
        await AddAchievementAsync(kevin, "Two-sport varsity letter", "Award", -20, "PENDING", null);

        AddDocument(juan, "Medical Clearance", -40);
        AddDocument(mark, "Medical Clearance", -5);
        AddDocument(mark, "Consent Form", -5);
        AddDocument(jasmine, "Enrollment Form", -2);
        AddDocument(carla, "Athletic Eligibility Form", -50);
        AddDocument(bea, "Medical Clearance", -1);

        Notify(juan.UserId, "Training session approved", "Team practice was approved and added to your schedule.", "TRAINING_APPROVED");
        Notify(ana.UserId, "Portfolio rejected", "Your submission \"Inter-school volleyball tournament MVP\" was rejected. Reason: certificate is unreadable.", "PORTFOLIO_REJECTED");
        await _context.SaveChangesAsync();

        Describe(juan, "Blue Eagles Basketball", "Model athlete: eligible, verified achievement, improving performance");
        Describe(ana, "Lady Spikers Volleyball", "INELIGIBLE (failing grades); rejected portfolio item");
        Describe(mark, "Blue Eagles Basketball", "Evaluation requested, Registrar has not uploaded the PDF; medical clearance and consent form on file");
        Describe(carla, "Blue Eagles Basketball", "SUSPENDED but still on the roster");
        Describe(miguel, "— (left Blue Eagles)", "INACTIVE: left the school, removed from team");
        Describe(sofia, "— (quit Lady Spikers)", "Quit the team 20 days ago, still an active student");
        Describe(daniel, "Blue Eagles Basketball", "Transferred from volleyball to basketball");
        Describe(bea, "—", "New athlete with no team");
        Describe(kevin, "Blue Eagles Basketball, Lady Spikers Volleyball", "Two sports; PDF uploaded, awaiting Registrar decision");
        Describe(jasmine, "Lady Spikers Volleyball", "17% attendance; ineligible last term, eligible again now");

        // ---------------- Parents (no university ID; linked to their children's athlete profiles) ----------------
        var parents = await CreatePlannedParentsAsync(skipExisting: false);
        var rosario = parents["Rosario"];
        var teresa = parents["Teresa"];
        Notify(rosario.UserId, "Training attendance recorded", "Juan Dela Cruz was marked present for Training — week 6.", "TRAINING_ATTENDANCE");
        Notify(teresa.UserId, "Training attendance recorded", "Jasmine Flores was marked absent for Training — week 6.", "TRAINING_ATTENDANCE");
        await _context.SaveChangesAsync();
    }

    private async Task SeedGeneratedAthletesAsync(TeamPlan[] teams)
    {
        for (var index = 0; index < GeneratedAthleteCount; index++)
        {
            var (firstName, lastName) = NextGeneratedName(index);
            var plan = teams[index % teams.Length];

            // Mostly ordinary active athletes, with a predictable sprinkling of edge cases.
            var status = index % 23 == 5 ? "SUSPENDED" : index % 29 == 13 ? "INACTIVE" : "ACTIVE";
            var unassigned = status == "ACTIVE" && index % 19 == 11;
            var quit = status == "ACTIVE" && !unassigned && index % 17 == 3;
            var secondPlan = status == "ACTIVE" && !unassigned && !quit && index % 25 == 9 ? teams[(index + 1) % teams.Length] : null;
            var left = status == "INACTIVE" || quit ? _today.AddDays(-(10 + index % 40)) : (DateTime?)null;

            var athlete = await CreateAthleteAsync($"SEED-A-{index + 11:D3}", firstName, lastName, status, Courses[index % Courses.Length], 1 + index % 4);
            var notes = new List<string>();
            if (status != "ACTIVE") notes.Add(status);

            if (!unassigned)
            {
                AddMember(plan, athlete, _today.AddMonths(-(3 + index % 9)), left);
                if (secondPlan != null) AddMember(secondPlan, athlete, _today.AddMonths(-(2 + index % 4)));
            }
            await _context.SaveChangesAsync();

            // Attendance and performance only for sessions while the athlete was on the team.
            if (!unassigned)
            {
                var reliability = 0.45 + _random.NextDouble() * 0.55;
                var attended = plan.PastSessions.Where(session => left == null || session.TrainingDate < left).ToList();
                MarkAttendance(attended, athlete, attended.Select(_ => RandomAttendance(reliability)).ToArray());
                var values = attended.Select((_, step) => Math.Round(plan.BaseValue + plan.Step * step + (decimal)(_random.NextDouble() - 0.5) * Math.Abs(plan.Step) * 2, 2)).ToArray();
                if (index % 3 != 2) AddPerformance(athlete, plan, attended, values);
                if (reliability < 0.6) notes.Add("low attendance");
                if (secondPlan != null) MarkAttendance(secondPlan.PastSessions.TakeLast(2).ToList(), athlete, ["PRESENT", "PRESENT"]);
            }
            await _context.SaveChangesAsync();

            // Eligibility: cycle through every Registrar outcome.
            switch (index % 10)
            {
                case 0: case 1: case 2: case 3: case 4:
                    await AddEligibilityAsync(athlete, _secondSem, "ELIGIBLE", [], null, 5 + index % 20, requestedBy: plan.Coach);
                    notes.Add("eligible");
                    break;
                case 5:
                    await AddEligibilityAsync(athlete, _firstSem, "ELIGIBLE", [], null, 110, requestedBy: plan.Coach);
                    await AddEligibilityAsync(athlete, _secondSem, "ELIGIBLE", [], "Consistent standing.", 9, requestedBy: plan.Coach);
                    notes.Add("eligible both terms");
                    break;
                case 6:
                    await AddEligibilityAsync(athlete, _secondSem, "INELIGIBLE", [IneligibleReasons[index % IneligibleReasons.Length]], "See the Grade Evaluation for details.", 7, requestedBy: plan.Coach);
                    notes.Add("INELIGIBLE");
                    break;
                case 7:
                    await AddEligibilityAsync(athlete, _secondSem, "PENDING", [], null, 2, withPdf: false, requestedBy: plan.Coach);
                    notes.Add("evaluation requested, no PDF");
                    break;
                case 8:
                    await AddEligibilityAsync(athlete, _secondSem, "PENDING", [], null, 3, requestedBy: plan.Coach);
                    notes.Add("PDF uploaded, awaiting decision");
                    break;
                default:
                    notes.Add("not evaluated");
                    break;
            }

            // Portfolio and documents for a share of athletes, in every review state.
            if (index % 3 == 0)
            {
                var review = (index / 3) % 3;
                var reviewStatus = review == 0 ? "VERIFIED" : review == 1 ? "PENDING" : "REJECTED";
                await AddAchievementAsync(athlete, $"{plan.Team.TeamName.Replace(Prefix, string.Empty)} — {(review == 0 ? "tournament medal" : review == 1 ? "most improved player" : "invitational finalist")}",
                    review == 0 ? "Competition" : "Award", -(10 + index), reviewStatus, review == 1 ? null : plan.Coach,
                    reviewStatus == "REJECTED" ? "Please attach the official certificate." : null);
                notes.Add($"achievement {reviewStatus.ToLowerInvariant()}");
            }
            if (index % 4 == 1) AddDocument(athlete, index % 8 == 1 ? "Medical Clearance" : "Consent Form", -(1 + index % 15));
            await _context.SaveChangesAsync();

            var teamLabel = unassigned
                ? "—"
                : left != null
                    ? $"— ({(quit ? "quit" : "left")} {plan.Team.TeamName.Replace(Prefix, string.Empty)})"
                    : string.Join(", ", new[] { plan, secondPlan }.Where(item => item != null).Select(item => item!.Team.TeamName.Replace(Prefix, string.Empty)));
            if (unassigned) notes.Insert(0, "no team");
            if (quit) notes.Insert(0, "quit the team");
            if (secondPlan != null) notes.Insert(0, "two teams");
            Describe(athlete, teamLabel, string.Join("; ", notes));
        }
    }

    // ------------------------------------------------------------------ builders

    private (string FirstName, string LastName) NextGeneratedName(int index)
    {
        for (var attempt = 0; ; attempt++)
        {
            var firstName = FirstNames[(index + attempt) % FirstNames.Length];
            var lastName = LastNames[(index * 7 + attempt * 3) % LastNames.Length];
            if (!_usedEmails.Contains(EmailFor(firstName, lastName))) return (firstName, lastName);
        }
    }

    private static string EmailFor(string firstName, string lastName) =>
        $"{firstName}.{lastName.Replace(" ", string.Empty)}".ToLowerInvariant() + EmailDomain;

    private User NewUser(string role, string? universityId, string firstName, string lastName, string status, string? email = null)
    {
        email ??= EmailFor(firstName, lastName);
        _usedEmails.Add(email);
        return new User
        {
            RoleId = _roles[role],
            UniversityId = universityId,
            Email = email,
            PasswordHash = _passwordHash,
            FirstName = firstName,
            LastName = lastName,
            Phone = $"0917 555 {(universityId ?? email).Sum(character => character * 7) % 10000:D4}",
            AccountStatus = status,
            CreatedAt = DateTime.UtcNow.AddMonths(-12)
        };
    }

    private async Task<User> CreateStaffAsync(string role, string universityId, string firstName, string lastName, string status, string scenario)
    {
        var user = NewUser(role, universityId, firstName, lastName, status);
        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        _accounts.Add(new AccountRow(role, $"{firstName} {lastName}", user.Email, status, "—", scenario));
        return user;
    }

    /// <summary>
    /// Adds only the parent accounts that do not exist yet, linked to the seed athletes already in the
    /// database. Unlike <see cref="SeedAsync"/>, nothing is removed, so testing progress is kept.
    /// </summary>
    public async Task SeedParentsAsync()
    {
        _roles = await _context.Roles.ToDictionaryAsync(role => role.RoleName, role => role.RoleId);
        if (!_roles.ContainsKey("PARENT"))
        {
            Console.Error.WriteLine("The PARENT role is missing. Start the API once so the database migrations run, then try again.");
            return;
        }

        await using var transaction = await _context.Database.BeginTransactionAsync();
        var created = await CreatePlannedParentsAsync(skipExisting: true);
        await transaction.CommitAsync();
        Console.WriteLine($"Added {created.Count} parent account(s). Password for each: {Password}");
    }

    /// <summary>
    /// Short sign-ins for hands-on testing: coach{n}@athletehub.test leads their own team. Students are
    /// student1 … student20@athletehub.test; odd numbers play for coach1, even numbers for coach2.
    /// </summary>
    private static readonly (string First, string Last, string Sport, string Workout, string Unit, decimal BaseValue, decimal Step)[] EasyCoaches =
    [
        ("Rico", "Valdez", "Basketball", "Vertical Jump", "NUMBER", 42, 1),
        ("Tess", "Manalastas", "Volleyball", "Serve Accuracy", "PERCENT", 60, 2.5m),
    ];

    private static readonly (string First, string Last)[] EasyStudents =
    [
        ("Leo", "Castillo"), ("Mia", "Santiago"), ("Josh", "Mercado"), ("Ella", "Torralba"), ("Miko", "Santillan"),
        ("Rina", "Galang"), ("Enzo", "Villareal"), ("Trisha", "Mendez"), ("Paulo", "Cabrera"), ("Kaye", "Rosales"),
        ("Jerome", "Aguilar"), ("Lara", "Pineda"), ("Renz", "Medina"), ("Nicole", "Vergara"), ("Aldrin", "Sison"),
        ("Shane", "Lozada"), ("Jomar", "Padilla"), ("Alyssa", "Gomez"), ("Cedric", "Ventura"), ("Jessa", "Morales"),
    ];

    private static readonly string[][] EasyAttendance =
    [
        ["PRESENT", "PRESENT", "LATE", "PRESENT"],
        ["PRESENT", "PRESENT", "PRESENT", "PRESENT"],
        ["PRESENT", "ABSENT", "PRESENT", "LATE"],
        ["LATE", "PRESENT", "PRESENT", "EXCUSED"],
        ["ABSENT", "ABSENT", "PRESENT", "ABSENT"],
    ];

    private static readonly string[] EasyEmails =
    [
        .. EasyCoaches.Select((_, index) => $"coach{index + 1}@athletehub.test"),
        .. EasyStudents.Select((_, index) => $"student{index + 1}@athletehub.test"),
    ];

    /// <summary>
    /// Adds the easy test accounts that are missing to a database that already has seed data. Like
    /// <see cref="SeedParentsAsync"/>, nothing is removed or changed, so testing progress is kept.
    /// </summary>
    public async Task SeedEasyAccountsAsync()
    {
        var existing = await _context.Users.CountAsync(user => EasyEmails.Contains(user.Email));
        if (existing == EasyEmails.Length) return;

        _roles = await _context.Roles.ToDictionaryAsync(role => role.RoleName, role => role.RoleId);
        _director = await _context.Users.FirstAsync(user => user.Role.RoleName == "DIRECTOR" && user.AccountStatus == "ACTIVE");

        await using var transaction = await _context.Database.BeginTransactionAsync();
        await CreateEasyAccountsAsync();
        await transaction.CommitAsync();
        Console.WriteLine($"Added {EasyEmails.Length - existing} easy test account(s) (coach1/coach2, student1 to student{EasyStudents.Length}@athletehub.test). Password for each: {Password}");
    }

    private async Task CreateEasyAccountsAsync()
    {
        for (var number = 1; number <= EasyCoaches.Length; number++)
        {
            var plan = await GetOrCreateEasyTeamAsync(number);
            for (var student = number; student <= EasyStudents.Length; student += EasyCoaches.Length)
            {
                await AddEasyStudentAsync(plan, number, student);
            }
        }
    }

    /// <summary>coach{n} and their team with a month of approved training, or the existing ones if already seeded.</summary>
    private async Task<TeamPlan> GetOrCreateEasyTeamAsync(int number)
    {
        var (first, last, sport, workout, unit, baseValue, step) = EasyCoaches[number - 1];
        var teamName = $"Test Team {number} {sport}";
        var email = $"coach{number}@athletehub.test";

        var coach = await _context.CoachProfiles.Include(profile => profile.User).FirstOrDefaultAsync(profile => profile.User.Email == email);
        var team = coach == null ? null : await _context.Teams.FirstOrDefaultAsync(item => item.CoachId == coach.CoachId && item.TeamName == Prefix + teamName);
        if (coach != null && team != null)
        {
            var metric = await _context.PerformanceMetricDefinitions.FirstAsync(item => item.SportId == team.SportId);
            var existing = new TeamPlan { Team = team, Coach = coach, Metric = metric, Workout = workout, Unit = unit, BaseValue = baseValue, Step = step };
            existing.PastSessions.AddRange(await _context.TrainingSessions
                .Where(session => session.TeamId == team.TeamId && session.ApprovalStatus == "APPROVED" && session.TrainingDate < _today)
                .OrderBy(session => session.TrainingDate)
                .ToListAsync());
            return existing;
        }

        coach ??= await CreateCoachAsync($"TEST-C-{number:D3}", first, last, "ACTIVE", sport, email);
        var plan = await PlanTeamAsync(sport, "TEAM", coach, teamName, workout, unit, baseValue, step);
        for (var week = 4; week >= 1; week--)
        {
            plan.PastSessions.Add(AddSession(plan, $"Training — week {5 - week}", _today.AddDays(-7 * week), "APPROVED"));
        }
        AddSession(plan, "Team practice", _today.AddDays(2), "APPROVED");
        AddSession(plan, "Extra conditioning (awaiting approval)", _today.AddDays(6), "PENDING");
        await _context.SaveChangesAsync();
        return plan;
    }

    /// <summary>student{n} on coach{coachNumber}'s team, with attendance and results that differ from student to student.</summary>
    private async Task AddEasyStudentAsync(TeamPlan plan, int coachNumber, int number)
    {
        var email = $"student{number}@athletehub.test";
        if (await _context.Users.AnyAsync(user => user.Email == email)) return;

        var (first, last) = EasyStudents[number - 1];
        var position = (number - 1) / EasyCoaches.Length;
        var student = await CreateAthleteAsync($"TEST-A-{number:D3}", first, last, "ACTIVE", Courses[number % Courses.Length], 1 + number % 4, email);

        AddMember(plan, student, _today.AddMonths(-2));
        await _context.SaveChangesAsync();

        MarkAttendance(plan.PastSessions, student, EasyAttendance[position % EasyAttendance.Length]);
        // Every fourth student has no results yet, so the coach can record the first ones.
        if (position % 4 != 3)
        {
            var start = plan.BaseValue + plan.Step * (position % 5);
            AddPerformance(student, plan, plan.PastSessions, [.. Enumerable.Range(0, plan.PastSessions.Count).Select(step => start + plan.Step * step)]);
        }
        await _context.SaveChangesAsync();
        Describe(student, plan.Team.TeamName.Replace(Prefix, string.Empty), $"Easy sign-in for testing; coached by coach{coachNumber}@athletehub.test");
    }

    private async Task<Dictionary<string, User>> CreatePlannedParentsAsync(bool skipExisting)
    {
        var created = new Dictionary<string, User>();
        foreach (var plan in ParentPlans)
        {
            var email = EmailFor(plan.FirstName, plan.LastName);
            if (skipExisting && await _context.Users.AnyAsync(user => user.Email == email))
            {
                Console.WriteLine($"{email} already exists — skipped.");
                continue;
            }

            var children = new List<(AthleteProfile Athlete, string Relationship)>();
            foreach (var (child, relationship) in plan.Children)
            {
                var childEmail = child + EmailDomain;
                var athlete = await _context.AthleteProfiles.Include(profile => profile.User).FirstOrDefaultAsync(profile => profile.User.Email == childEmail);
                if (athlete == null)
                {
                    Console.WriteLine($"{childEmail} not found — {plan.FirstName} {plan.LastName} is created without that link.");
                    continue;
                }
                children.Add((athlete, relationship));
            }

            created[plan.FirstName] = await CreateParentAsync(plan.FirstName, plan.LastName, [.. children], plan.Scenario);
            Console.WriteLine($"Created {email} ({(children.Count == 0 ? "no linked children" : string.Join(", ", children.Select(item => item.Athlete.User.FirstName + " " + item.Athlete.User.LastName)))}).");
        }
        return created;
    }

    /// <summary>A parent account (no university ID) linked to the given children.</summary>
    private async Task<User> CreateParentAsync(string firstName, string lastName, (AthleteProfile Athlete, string Relationship)[] children, string scenario)
    {
        var user = NewUser("PARENT", null, firstName, lastName, "ACTIVE");
        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        foreach (var (athlete, relationship) in children)
        {
            _context.ParentAthletes.Add(new ParentAthlete { ParentUserId = user.UserId, AthleteId = athlete.AthleteId, Relationship = relationship, CreatedAt = DateTime.UtcNow });
        }
        await _context.SaveChangesAsync();
        var linked = children.Length == 0 ? "—" : string.Join(", ", children.Select(child => $"{child.Athlete.User.FirstName} {child.Athlete.User.LastName} ({child.Relationship.ToLowerInvariant()})"));
        _accounts.Add(new AccountRow("PARENT", $"{firstName} {lastName}", user.Email, "ACTIVE", linked, scenario));
        return user;
    }

    private async Task<CoachProfile> CreateCoachAsync(string universityId, string firstName, string lastName, string status, string specialization, string? email = null)
    {
        var user = NewUser("COACH", universityId, firstName, lastName, status, email);
        var coach = new CoachProfile { User = user, Specialization = specialization };
        _context.CoachProfiles.Add(coach);
        await _context.SaveChangesAsync();
        return coach;
    }

    private async Task<AthleteProfile> CreateAthleteAsync(string universityId, string firstName, string lastName, string status, string course, int yearLevel, string? email = null)
    {
        var user = NewUser("ATHLETE", universityId, firstName, lastName, status, email);
        var athlete = new AthleteProfile
        {
            User = user,
            StudentNumber = universityId,
            Course = course,
            YearLevel = yearLevel,
            BirthDate = new DateTime(2006 - yearLevel, 1 + universityId.Length % 12, 1 + yearLevel * 5)
        };
        _context.AthleteProfiles.Add(athlete);
        await _context.SaveChangesAsync();
        return athlete;
    }

    private void Describe(AthleteProfile athlete, string team, string scenario) =>
        _accounts.Add(new AccountRow("ATHLETE", $"{athlete.User.FirstName} {athlete.User.LastName}", athlete.User.Email, athlete.User.AccountStatus, team, scenario));

    private async Task<TeamPlan> PlanTeamAsync(string sportName, string sportType, CoachProfile coach, string teamName,
        string workout, string unit, decimal baseValue, decimal step, bool active = true)
    {
        var sport = await _context.Sports.FirstOrDefaultAsync(item => item.SportName == sportName);
        if (sport == null)
        {
            sport = new Sport { SportName = sportName, SportType = sportType, Description = $"{sportName} program" };
            _context.Sports.Add(sport);
            await _context.SaveChangesAsync();
        }

        var metric = await _context.PerformanceMetricDefinitions.FirstOrDefaultAsync(item => item.SportId == sport.SportId);
        if (metric == null)
        {
            metric = new PerformanceMetricDefinition { SportId = sport.SportId, MetricName = workout, Unit = unit.ToLowerInvariant(), Description = $"{workout} for {sportName}" };
            _context.PerformanceMetricDefinitions.Add(metric);
            await _context.SaveChangesAsync();
        }

        var team = new Team { SportId = sport.SportId, CoachId = coach.CoachId, TeamName = Prefix + teamName, SchoolYear = "2026-2027", Status = active ? "ACTIVE" : "INACTIVE" };
        _context.Teams.Add(team);
        await _context.SaveChangesAsync();

        var coachStatus = coach.User.AccountStatus;
        var coachScenario = !active
            ? "INACTIVE coach; his team is disbanded"
            : coachStatus == "SUSPENDED" ? "SUSPENDED coach; team remains active without new sessions" : $"Coaches {teamName}";
        _accounts.Add(new AccountRow("COACH", $"{coach.User.FirstName} {coach.User.LastName}", coach.User.Email, coachStatus, teamName, coachScenario));

        return new TeamPlan { Team = team, Coach = coach, Metric = metric, Workout = workout, Unit = unit, BaseValue = baseValue, Step = step };
    }

    private async Task<AcademicTerm> GetOrCreateTermAsync(string year, string semester)
    {
        var term = await _context.AcademicTerms.FirstOrDefaultAsync(item => item.AcademicYear == year && item.Semester == semester);
        if (term != null) return term;
        term = new AcademicTerm { AcademicYear = year, Semester = semester };
        _context.AcademicTerms.Add(term);
        await _context.SaveChangesAsync();
        return term;
    }

    private void AddMember(TeamPlan plan, AthleteProfile athlete, DateTime joined, DateTime? left = null) =>
        _context.TeamMembers.Add(new TeamMember { TeamId = plan.Team.TeamId, AthleteId = athlete.AthleteId, DateJoined = joined, DateLeft = left });

    private TrainingSession AddSession(TeamPlan plan, string title, DateTime date, string status, string? rejectionReason = null)
    {
        var session = new TrainingSession
        {
            TeamId = plan.Team.TeamId,
            CoachId = plan.Coach.CoachId,
            Title = title,
            Description = "Seeded training session.",
            TrainingDate = date.Date,
            StartTime = new TimeSpan(16, 0, 0),
            EndTime = new TimeSpan(18, 0, 0),
            Location = plan.Team.TeamName.Contains("Swimming") ? "University Pool" : plan.Team.TeamName.Contains("Football") ? "Football Field" : "Gymnasium",
            ApprovalStatus = status,
            SubmittedAt = date.AddDays(-7),
            ReviewedAt = status == "PENDING" ? null : date.AddDays(-6),
            ReviewedBy = status == "PENDING" ? null : _director.UserId,
            RejectionReason = rejectionReason
        };
        _context.TrainingSessions.Add(session);
        return session;
    }

    private string RandomAttendance(double reliability)
    {
        var roll = _random.NextDouble();
        if (roll < reliability) return roll < reliability * 0.85 ? "PRESENT" : "LATE";
        return roll < reliability + (1 - reliability) * 0.2 ? "EXCUSED" : "ABSENT";
    }

    private void MarkAttendance(IReadOnlyList<TrainingSession> sessions, AthleteProfile athlete, string[] statuses)
    {
        for (var index = 0; index < sessions.Count && index < statuses.Length; index++)
        {
            _context.Attendances.Add(new Attendance
            {
                TrainingSessionId = sessions[index].TrainingSessionId,
                AthleteId = athlete.AthleteId,
                AttendanceStatus = statuses[index],
                Remarks = statuses[index] == "EXCUSED" ? "Medical appointment" : null
            });
        }
    }

    private void AddPerformance(AthleteProfile athlete, TeamPlan plan, IReadOnlyList<TrainingSession> sessions, decimal[] values, string? workout = null, string? unit = null)
    {
        for (var index = 0; index < sessions.Count && index < values.Length; index++)
        {
            _context.PerformanceRecords.Add(new PerformanceRecord
            {
                AthleteId = athlete.AthleteId,
                MetricId = plan.Metric.MetricId,
                CoachId = plan.Coach.CoachId,
                RecordedValue = values[index],
                RecordedDate = sessions[index].TrainingDate,
                DataType = workout ?? plan.Workout,
                Unit = unit ?? plan.Unit,
                SessionId = sessions[index].TrainingSessionId,
                Notes = index == sessions.Count - 1 ? "Most recent test." : null
            });
        }
    }

    private async Task AddEligibilityAsync(AthleteProfile athlete, AcademicTerm term, string status, string[] reasons, string? remarks, int daysAgo, bool withPdf = true, CoachProfile? requestedBy = null)
    {
        Document? pdf = null;
        if (withPdf)
        {
            var fileName = $"{FilePrefix}{Guid.NewGuid():N}.pdf";
            WriteFile("grade-evaluations", fileName, PlaceholderPdf($"Grade Evaluation - {athlete.StudentNumber} - {term.Semester} {term.AcademicYear}"));
            pdf = new Document
            {
                AthleteId = athlete.AthleteId,
                DocumentType = "GRADE_EVALUATION",
                Title = "Official Grade Evaluation",
                Description = $"{term.AcademicYear} · {term.Semester}",
                DocumentName = $"GradeEvaluation_{athlete.StudentNumber}_{term.Semester.Replace(' ', '_')}.pdf",
                FileUrl = $"grade-evaluations/{fileName}",
                Status = "APPROVED",
                UploadedAt = DateTime.UtcNow.AddDays(-daysAgo + 1)
            };
            _context.Documents.Add(pdf);
            await _context.SaveChangesAsync();
        }

        var decided = status != "PENDING";
        _context.EligibilityRecords.Add(new EligibilityRecord
        {
            AthleteId = athlete.AthleteId,
            TermId = term.TermId,
            AcademicStatus = status,
            EligibilityReasons = JsonSerializer.Serialize(reasons),
            Remarks = remarks,
            // Coaches request evaluations for their athletes.
            RequestedBy = requestedBy?.UserId ?? _director.UserId,
            RequestedAt = DateTime.UtcNow.AddDays(-daysAgo),
            DocumentId = pdf?.DocumentId,
            UploadedBy = pdf == null ? null : _registrar.UserId,
            ReviewedBy = decided ? _registrar.UserId : null,
            ReviewedAt = decided ? DateTime.UtcNow.AddDays(-daysAgo + 2) : null,
            EvaluatedAt = decided ? DateTime.UtcNow.AddDays(-daysAgo + 2) : null
        });
        await _context.SaveChangesAsync();
    }

    private async Task AddAchievementAsync(AthleteProfile athlete, string title, string category, int daysOffset, string status, CoachProfile? reviewer, string? rejectionReason = null)
    {
        var verifiedAt = status == "PENDING" ? (DateTime?)null : DateTime.UtcNow.AddDays(daysOffset + 5);
        var achievement = new Achievement
        {
            AthleteId = athlete.AthleteId,
            Title = title,
            Description = "Seeded achievement with placeholder evidence.",
            AchievementDate = _today.AddDays(daysOffset),
            Category = category,
            VerificationStatus = status,
            VerifiedBy = reviewer?.UserId,
            VerifiedAt = verifiedAt,
            RejectionReason = rejectionReason,
            CreatedAt = DateTime.UtcNow.AddDays(daysOffset + 2)
        };
        _context.Achievements.Add(achievement);
        await _context.SaveChangesAsync();

        var fileName = $"{FilePrefix}{Guid.NewGuid():N}.pdf";
        WriteFile("documents", fileName, PlaceholderPdf($"Evidence: {title}"));
        _context.Documents.Add(new Document
        {
            AthleteId = athlete.AthleteId,
            AchievementId = achievement.AchievementId,
            DocumentType = "Achievement Evidence",
            Title = title,
            DocumentName = "certificate.pdf",
            FileUrl = $"documents/{fileName}",
            Status = status switch { "VERIFIED" => "APPROVED", "REJECTED" => "REJECTED", _ => "PENDING" },
            UploadedAt = achievement.CreatedAt
        });
        _context.PortfolioItems.Add(new PortfolioItem
        {
            AthleteId = athlete.AthleteId,
            AchievementId = achievement.AchievementId,
            Title = title,
            Description = achievement.Description,
            DisplayOrder = 0,
            IsVisible = true,
            CreatedAt = achievement.CreatedAt,
            VerificationStatus = status,
            VerifiedBy = reviewer?.UserId,
            VerifiedAt = verifiedAt,
            RejectionReason = rejectionReason
        });
        if (status == "REJECTED")
        {
            Notify(athlete.UserId, "Portfolio rejected", $"Your submission \"{title}\" was rejected. Reason: {rejectionReason}", "PORTFOLIO_REJECTED");
        }
    }

    private void AddDocument(AthleteProfile athlete, string type, int daysOffset)
    {
        var fileName = $"{FilePrefix}{Guid.NewGuid():N}.pdf";
        WriteFile("documents", fileName, PlaceholderPdf($"{type} - {athlete.StudentNumber}"));
        _context.Documents.Add(new Document
        {
            AthleteId = athlete.AthleteId,
            DocumentType = type,
            Title = $"{type} 2026-2027",
            DocumentName = $"{type.Replace(' ', '_')}.pdf",
            FileUrl = $"documents/{fileName}",
            Status = "APPROVED",
            UploadedAt = DateTime.UtcNow.AddDays(daysOffset)
        });
    }

    private void Notify(int userId, string title, string message, string type) =>
        _context.Notifications.Add(new Notification { UserId = userId, Title = title, Message = message, NotificationType = type, IsRead = false, CreatedAt = DateTime.UtcNow.AddHours(-2) });

    private void WriteFile(string folder, string fileName, byte[] content)
    {
        var directory = Path.Combine(_contentRoot, "private-uploads", folder);
        Directory.CreateDirectory(directory);
        File.WriteAllBytes(Path.Combine(directory, fileName), content);
    }

    /// <summary>
    /// Writes the account list as Markdown next to the database scripts (or the content root if that folder is missing).
    /// </summary>
    private string WriteAccountTable()
    {
        var databaseFolder = Path.GetFullPath(Path.Combine(_contentRoot, "..", "..", "database"));
        var path = Path.Combine(Directory.Exists(databaseFolder) ? databaseFolder : _contentRoot, "TEST_ACCOUNTS.md");
        var roleOrder = new[] { "DIRECTOR", "ADMIN", "REGISTRAR", "COACH", "ATHLETE", "PARENT" };

        var builder = new StringBuilder();
        builder.AppendLine("# Test accounts");
        builder.AppendLine();
        builder.AppendLine("Generated by `dotnet run -- --seed-test-data` (see TEST_SCENARIOS.md). Development data only.");
        builder.AppendLine();
        builder.AppendLine($"**Password for every account: `{Password}`**. Accounts that are not ACTIVE cannot sign in — that is part of the test.");
        builder.AppendLine();
        builder.AppendLine("| Role | Count |");
        builder.AppendLine("|---|---|");
        foreach (var role in roleOrder) builder.AppendLine($"| {role} | {_accounts.Count(row => row.Role == role)} |");
        builder.AppendLine($"| **Total** | **{_accounts.Count}** |");

        foreach (var role in roleOrder)
        {
            builder.AppendLine();
            var heading = $"{role[0]}{role[1..].ToLowerInvariant()}";
            builder.AppendLine($"## {heading}{(heading.EndsWith("h") ? "es" : "s")}");
            builder.AppendLine();
            builder.AppendLine(role == "PARENT" ? "| # | Name | Email | Status | Can sign in | Linked children | Scenario |" : "| # | Name | Email | Status | Can sign in | Team | Scenario |");
            builder.AppendLine("|---|---|---|---|---|---|---|");
            var number = 1;
            foreach (var row in _accounts.Where(row => row.Role == role))
            {
                builder.AppendLine($"| {number++} | {row.Name} | `{row.Email}` | {row.Status} | {(row.Status == "ACTIVE" ? "Yes" : "No")} | {row.Team} | {row.Scenario} |");
            }
        }

        File.WriteAllText(path, builder.ToString());
        return path;
    }

    /// <summary>A minimal valid one-page PDF showing a line of text, so previews render.</summary>
    private static byte[] PlaceholderPdf(string text)
    {
        var safe = text.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
        var ascii = new string(safe.Select(character => character < 128 ? character : '-').ToArray());
        var stream = $"BT /F1 16 Tf 72 720 Td (SAMPLE - {ascii}) Tj ET";
        var objects = new[]
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            $"<< /Length {Encoding.ASCII.GetByteCount(stream)} >>\nstream\n{stream}\nendstream",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
        };
        var builder = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int>();
        for (var index = 0; index < objects.Length; index++)
        {
            offsets.Add(Encoding.ASCII.GetByteCount(builder.ToString()));
            builder.Append($"{index + 1} 0 obj\n{objects[index]}\nendobj\n");
        }
        var xref = Encoding.ASCII.GetByteCount(builder.ToString());
        builder.Append($"xref\n0 {objects.Length + 1}\n0000000000 65535 f \n");
        foreach (var offset in offsets) builder.Append($"{offset:D10} 00000 n \n");
        builder.Append($"trailer\n<< /Size {objects.Length + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return Encoding.ASCII.GetBytes(builder.ToString());
    }
}
