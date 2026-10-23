using System.Text;
using System.Text.Json;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Data;

/// <summary>
/// Realistic demonstration data for presenting Athlete-Hub: a Sports Director, six coaches with one team each,
/// forty student-athletes, and four parents, with about two months of training, attendance, results, portfolio
/// entries, documents, schedules, notifications, ICTD grades, and coach evaluations.
///
/// Student IDs follow the school format: A (regular) or T (transfer), the two-digit year the student entered,
/// then the student number, e.g. A23-30517. Staff IDs use C (coach) or D (director) and the year hired. Athletes,
/// coaches, and the Director sign in with their ID as the email name (A23-30517@athlete.edu.ph); parents use
/// their personal email. Every account uses the password <see cref="Password"/>.
///
/// Dates are relative to the day the data is created, so "upcoming" items stay upcoming: re-create the data
/// shortly before a presentation.
///
///   dotnet run -- --reset-demo-data   (deletes ALL data, then creates the demo data)
///   dotnet run -- --wipe-all-data     (deletes ALL data; a hosted API then refills it on its next start)
/// </summary>
public class DemoDataSeeder
{
    public const string Password = "Seed123!";
    public const string Domain = "@athlete.edu.ph";
    private const string FilePrefix = "demo-";
    private const string SchoolYear = "2026-2027";

    // ------------------------------------------------------------------ the people

    private static readonly (string Id, string First, string Last) Director = ("D14-10027", "Elena", "Navarro");

    private sealed record TeamSpec(string Key, string Name, string Sport, string SportType, string CoachId, string CoachFirst, string CoachLast,
        DayOfWeek[] Days, TimeSpan Start, TimeSpan End, string Location, string[] Titles, (string Workout, string Unit, decimal Base, decimal Step)[] Workouts);

    private static readonly TeamSpec[] Teams =
    [
        new("bb", "Men's Varsity Basketball", "Basketball", "TEAM", "C18-20415", "Ramon", "Aguilar",
            [DayOfWeek.Monday, DayOfWeek.Thursday], new(16, 0, 0), new(18, 0, 0), "University Gymnasium",
            ["Team practice", "Strength and conditioning"],
            [("Vertical Jump (cm)", "NUMBER", 52m, 0.6m), ("Sprint 20m", "SECONDS", 3.45m, -0.015m), ("Free Throws Made (of 10)", "NUMBER", 6m, 0.15m)]),
        new("vb", "Women's Varsity Volleyball", "Volleyball", "TEAM", "C20-20872", "Liza", "Mendoza",
            [DayOfWeek.Tuesday, DayOfWeek.Friday], new(16, 0, 0), new(18, 0, 0), "University Gymnasium",
            ["Team practice", "Serve and receive drills"],
            [("Serve Accuracy", "PERCENT", 64m, 1.6m), ("Block Jump (cm)", "NUMBER", 44m, 0.5m)]),
        new("fb", "Men's Football Team", "Football", "TEAM", "C19-20533", "Arnel", "Gonzales",
            [DayOfWeek.Monday, DayOfWeek.Wednesday], new(15, 30, 0), new(17, 30, 0), "University Football Field",
            ["Team practice", "Speed and agility"],
            [("Sprint 30m", "SECONDS", 4.65m, -0.02m), ("Beep Test Level", "NUMBER", 9m, 0.15m)]),
        new("bd", "Badminton Team", "Badminton", "INDIVIDUAL", "C21-21094", "Joy", "Ramirez",
            [DayOfWeek.Tuesday, DayOfWeek.Thursday], new(17, 0, 0), new(19, 0, 0), "Sports Center, Court 2",
            ["Skills training", "Match practice"],
            [("Smash Speed (km/h)", "NUMBER", 205m, 1.8m), ("Shuttle Run", "SECONDS", 12.4m, -0.06m)]),
        new("sw", "Swimming Team", "Swimming", "INDIVIDUAL", "C17-20108", "Rhea", "Soriano",
            [DayOfWeek.Wednesday, DayOfWeek.Saturday], new(6, 0, 0), new(8, 0, 0), "University Aquatic Center",
            ["Endurance sets", "Time trials"],
            [("50m Freestyle", "SECONDS", 29.8m, -0.1m), ("100m Freestyle", "SECONDS", 66.5m, -0.25m)]),
        new("tf", "Track and Field Team", "Track and Field", "INDIVIDUAL", "C22-21367", "Dennis", "Yap",
            [DayOfWeek.Tuesday, DayOfWeek.Friday], new(15, 0, 0), new(17, 0, 0), "University Oval",
            ["Speed work", "Endurance run"],
            [("100m Sprint", "SECONDS", 12.3m, -0.03m), ("Long Jump (m)", "NUMBER", 5.4m, 0.03m)]),
    ];

    /// <summary>Teams lists the athlete's team keys (empty for no team); Note is shown in the account list.</summary>
    private sealed record AthleteSpec(string Id, string First, string Last, string Course, int Year, string[] Teams, string Note = "");

    private static readonly AthleteSpec[] Athletes =
    [
        new("A24-31842", "Marco", "Villareal", "BS Information Technology", 3, ["bb"], "Demo student: coach evaluation waiting, verified achievement, parent linked"),
        new("A23-30517", "Paolo", "Reyes", "BS Business Administration", 4, ["bb"], "Team captain; sibling of Nicole Reyes"),
        new("A25-33208", "Jerome", "Aquino", "BS Accountancy", 2, ["bb"], "Portfolio entry waiting for the coach"),
        new("T25-34190", "Kenneth", "Bautista", "BS Civil Engineering", 3, ["bb"], "Transfer student"),
        new("A26-35073", "Adrian", "Salazar", "BS Computer Science", 1, ["bb"]),
        new("A24-31977", "Joshua", "Tan", "BS Psychology", 3, ["bb"], "SUSPENDED account (cannot sign in)"),
        new("A25-33452", "Miguel", "Ocampo", "BS Hospitality Management", 2, ["bb"]),

        new("A23-30288", "Andrea", "Castillo", "BS Nursing", 4, ["vb"], "Verified gold medal"),
        new("A24-32065", "Kristine", "Lopez", "BS Accountancy", 3, ["vb"]),
        new("A25-33617", "Mae", "Fernandez", "BS Education", 2, ["vb"], "Portfolio entry waiting for the coach"),
        new("A26-35219", "Nicole", "Reyes", "BA Communication", 1, ["vb"], "Sibling of Paolo Reyes"),
        new("A24-32340", "Patricia", "Dizon", "BS Psychology", 3, ["vb"]),
        new("A25-33790", "Jasmine", "Flores", "BS Biology", 2, ["vb"], "Low attendance (flagged for the coach)"),
        new("T24-32811", "Camille", "Torres", "BS Business Administration", 4, ["vb"], "Transfer student"),

        new("A23-30655", "Gabriel", "Santiago", "BS Civil Engineering", 4, ["fb"]),
        new("A24-32498", "Rafael", "Cruz", "BS Information Technology", 3, ["fb"]),
        new("A26-35402", "Daniel", "Abad", "BS Architecture", 1, ["fb"]),
        new("T26-35880", "Ivan", "Estrada", "BS Computer Science", 2, ["fb"], "Transfer student; no medical clearance yet"),
        new("A25-34016", "Nathan", "Robles", "BS Accountancy", 2, ["fb"]),
        new("A24-32713", "Luis", "Garcia", "BS Hospitality Management", 3, ["fb"]),
        new("A26-35566", "Kyle", "Fajardo", "BS Education", 1, ["fb"], "Rejected portfolio entry"),

        new("A24-32906", "Sofia", "Lim", "BS Biology", 3, ["bd"]),
        new("A25-34233", "Kevin", "Chua", "BS Information Technology", 2, ["bd", "tf"], "Plays two sports (badminton and track)"),
        new("A26-35691", "Hannah", "Uy", "BS Accountancy", 1, ["bd"]),
        new("A23-30902", "Ethan", "Go", "BS Business Administration", 4, ["bd"]),
        new("A25-34387", "Rina", "Galang", "BS Nursing", 2, ["bd"]),
        new("T25-34655", "Vincent", "Sy", "BS Computer Science", 3, ["bd"], "Transfer student"),

        new("A24-33081", "Isabel", "Morales", "BS Nursing", 3, ["sw"]),
        new("A23-31146", "Francis", "Javier", "BS Education", 4, ["sw"]),
        new("A25-34502", "Erika", "Panganiban", "BA Communication", 2, ["sw"]),
        new("A24-33166", "Tristan", "Valdez", "BS Architecture", 3, ["sw"], "Rejected portfolio entry"),
        new("T26-36024", "Lea", "Domingo", "BS Psychology", 2, ["sw"], "Transfer student"),
        new("A26-35947", "Martin", "Agustin", "BS Information Technology", 1, ["sw"]),

        new("A23-31390", "Samantha", "Cortez", "BS Biology", 4, ["tf"]),
        new("A24-33325", "Joaquin", "Evangelista", "BS Civil Engineering", 3, ["tf"]),
        new("A25-34771", "Denise", "Pascual", "BS Accountancy", 2, ["tf"]),
        new("A26-36118", "Emilio", "Tolentino", "BS Computer Science", 1, ["tf"]),
        new("A25-34948", "Hazel", "Umali", "BS Education", 2, ["tf"], "No medical clearance yet"),
        new("A24-33509", "Oscar", "Buenaventura", "BS Hospitality Management", 3, ["tf"]),

        new("A26-36302", "Bianca", "Herrera", "BS Psychology", 1, [], "Newly registered; not on a team yet"),
    ];

    private const string SuspendedId = "A24-31977";
    private const string LowAttendanceId = "A25-33790";
    private const string DemoStudentId = "A24-31842";
    // Joined the second team partway through the semester.
    private const string LateJoinerId = "A25-34233";

    private static readonly (string First, string Last, string Email, (string ChildId, string Relationship)[] Children)[] Parents =
    [
        ("Marivic", "Villareal", "marivicvillareal@gmail.com", [("A24-31842", "Mother")]),
        ("Alma", "Reyes", "almareyes.ph@gmail.com", [("A23-30517", "Mother"), ("A26-35219", "Mother")]),
        ("Roberto", "Flores", "bobbyflores72@yahoo.com", [("A25-33790", "Father")]),
        ("Grace", "Lim", "gracelim_1980@gmail.com", [("A24-32906", "Mother")]),
    ];

    // ------------------------------------------------------------------ portfolio

    private static readonly (string AthleteId, string Title, string Category, int DaysAgo, string Status, string? Reason)[] PortfolioPlan =
    [
        ("A24-31842", "Inter-Collegiate Basketball League 2026 — Champion", "Competition", 110, "VERIFIED", null),
        ("A23-30517", "Team Captain, Men's Varsity Basketball 2026-2027", "Leadership", 70, "VERIFIED", null),
        ("A23-30288", "PRISAA Regional Meet 2026 — Women's Volleyball, Gold", "Competition", 150, "VERIFIED", null),
        ("A24-32065", "Dean's List — 2nd Semester 2025-2026", "Academic", 95, "VERIFIED", null),
        ("A23-30655", "Provincial Football League 2026 — Best Midfielder", "Award", 120, "VERIFIED", null),
        ("A24-32906", "City Mayor's Cup Badminton 2026 — Women's Singles, Silver", "Competition", 60, "VERIFIED", null),
        ("A24-33081", "Regional Swimming Championship 2026 — 100m Freestyle, Bronze", "Competition", 85, "VERIFIED", null),
        ("A23-31146", "Lifeguard and Water Safety Certificate", "Certification", 200, "VERIFIED", null),
        ("A23-31390", "PRISAA Regional Meet 2026 — Women's 400m, Gold", "Competition", 150, "VERIFIED", null),
        ("A25-33208", "Inter-Collegiate Basketball League 2026 — Mythical Five", "Award", 9, "PENDING", null),
        ("A25-33617", "Volleyball Coaching Clinic Certificate", "Certification", 6, "PENDING", null),
        ("A25-34233", "Regional Badminton Open 2026 — Men's Doubles, Bronze", "Competition", 12, "PENDING", null),
        ("A24-33325", "University Fun Run 10K — 1st place", "Competition", 4, "PENDING", null),
        ("A25-34502", "Regional Swimming Championship 2026 — 50m Butterfly, Silver", "Competition", 8, "PENDING", null),
        ("A24-32498", "Dean's List — 2nd Semester 2025-2026", "Academic", 3, "PENDING", null),
        ("A24-33166", "Regional Swimming Championship — 200m Individual Medley, Silver", "Competition", 40, "REJECTED",
            "The certificate you uploaded is from 2024, not this year's meet. Please upload the 2026 certificate."),
        ("A26-35566", "Sports First Aid Training Certificate", "Certification", 20, "REJECTED",
            "The photo of the certificate is too blurry to read. Please upload a clearer scan."),
    ];

    private static readonly string[] EvaluationComments =
    [
        "Coach explains the plays clearly and always gives feedback after games.",
        "Trainings are well planned. I hope we get more practice games before the league starts.",
        "Very understanding during exam week and lets us make up missed sessions.",
        "Practice sometimes starts late, but the drills really improved my endurance.",
        "Fair to everyone and pushes us to do better every week.",
        "I learned a lot about proper technique this semester.",
        "Please give us more time to rest before competitions.",
    ];

    private static readonly string[] ExcusedRemarks = ["Medical appointment", "Class field trip", "Midterm examination", "Family emergency"];

    // ------------------------------------------------------------------ state

    private readonly AthleteHubDbContext _context;
    private readonly IctdGradeSync _gradeSync;
    private readonly string _contentRoot;
    private readonly DateTime _today;
    private readonly string _passwordHash = BCrypt.Net.BCrypt.HashPassword(Password);
    private readonly Random _random = new(2026);

    private Dictionary<string, int> _roles = [];
    private User _director = null!;
    private readonly Dictionary<string, TeamState> _teams = [];
    private readonly Dictionary<string, AthleteProfile> _athletes = [];
    private readonly List<(string Role, string Id, string Name, string Email, string Status, string Team, string Note)> _accounts = [];

    private sealed class TeamState
    {
        public required TeamSpec Spec { get; init; }
        public required Team Team { get; init; }
        public required CoachProfile Coach { get; init; }
        public required PerformanceMetricDefinition Metric { get; init; }
        public List<TrainingSession> Past { get; } = [];
        public List<TrainingSession> Upcoming { get; } = [];
        public List<AthleteProfile> Members { get; } = [];
    }

    public DemoDataSeeder(AthleteHubDbContext context, AppClock clock, IWebHostEnvironment environment, IctdGradeSync gradeSync)
    {
        _context = context;
        _gradeSync = gradeSync;
        _contentRoot = environment.ContentRootPath;
        _today = clock.LocalToday;
    }

    /// <summary>True when the database has no accounts at all, so demo data can be added without mixing.</summary>
    public async Task<bool> IsEmptyAsync() => !await _context.Users.AnyAsync();

    // ------------------------------------------------------------------ wipe

    /// <summary>
    /// Deletes every account and record, keeping only the reference lists (roles, sports, and their workouts),
    /// and removes the uploaded files stored on this computer.
    /// </summary>
    public async Task WipeAsync()
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();
        // Children before parents.
        await _context.CoachEvaluations.ExecuteDeleteAsync();
        await _context.Attendances.ExecuteDeleteAsync();
        await _context.PerformanceRecords.ExecuteDeleteAsync();
        await _context.AcademicRecords.ExecuteDeleteAsync();
        await _context.AcademicImportBatches.ExecuteDeleteAsync();
        await _context.EligibilityRecords.ExecuteDeleteAsync();
        await _context.PortfolioItems.ExecuteDeleteAsync();
        await _context.Documents.ExecuteDeleteAsync();
        await _context.Achievements.ExecuteDeleteAsync();
        await _context.TrainingSessions.ExecuteDeleteAsync();
        await _context.TeamMembers.ExecuteDeleteAsync();
        await _context.ParentAthletes.ExecuteDeleteAsync();
        await _context.Teams.ExecuteDeleteAsync();
        await _context.Schedules.ExecuteDeleteAsync();
        await _context.Announcements.ExecuteDeleteAsync();
        await _context.Notifications.ExecuteDeleteAsync();
        await _context.AthleteProfiles.ExecuteDeleteAsync();
        await _context.CoachProfiles.ExecuteDeleteAsync();
        await _context.Users.ExecuteDeleteAsync();
        await _context.AcademicTerms.ExecuteDeleteAsync();
        await transaction.CommitAsync();

        foreach (var folder in new[] { "documents", "grade-evaluations" })
        {
            var directory = Path.Combine(_contentRoot, "private-uploads", folder);
            if (!Directory.Exists(directory)) continue;
            foreach (var file in Directory.EnumerateFiles(directory)) File.Delete(file);
        }
        Console.WriteLine("Deleted every account and record.");
    }

    // ------------------------------------------------------------------ seed

    public async Task SeedAsync()
    {
        if (!await IsEmptyAsync()) throw new InvalidOperationException("The database still has accounts. Wipe it first so demo data is not mixed with other data.");
        _roles = await _context.Roles.ToDictionaryAsync(role => role.RoleName, role => role.RoleId);

        await using (var transaction = await _context.Database.BeginTransactionAsync())
        {
            _director = NewUser("DIRECTOR", Director.Id, Director.First, Director.Last, IdEmail(Director.Id), hiredYear: 2014);
            _context.Users.Add(_director);
            await _context.SaveChangesAsync();
            _accounts.Add(("DIRECTOR", Director.Id, $"{Director.First} {Director.Last}", _director.Email, "ACTIVE", "—", "Approves training, publishes events, manages accounts"));

            foreach (var spec in Teams) await CreateTeamAsync(spec);
            foreach (var spec in Athletes) await CreateAthleteAsync(spec);
            await CreateParentsAsync();

            foreach (var state in _teams.Values) AddPastTraining(state);
            await _context.SaveChangesAsync();
            AddAttendanceAndResults();
            await _context.SaveChangesAsync();

            AddUpcomingTraining();
            AddEvents();
            await _context.SaveChangesAsync();

            await AddPortfolioAsync();
            AddDocuments();
            AddNotifications();
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }

        // Grades come from the (simulated) ICTD database, which also sends the coach evaluation forms.
        await _gradeSync.SyncAsync();
        await AnswerSomeEvaluationsAsync();

        var path = WriteAccountList();
        Console.WriteLine($"Created demo data: {_accounts.Count} accounts (password {Password}). Account list: {path}");
    }

    private async Task CreateTeamAsync(TeamSpec spec)
    {
        var coachUser = NewUser("COACH", spec.CoachId, spec.CoachFirst, spec.CoachLast, IdEmail(spec.CoachId), hiredYear: 2000 + int.Parse(spec.CoachId[1..3]));
        var coach = new CoachProfile { User = coachUser, Specialization = spec.Sport };
        _context.CoachProfiles.Add(coach);

        var sport = await _context.Sports.FirstOrDefaultAsync(item => item.SportName == spec.Sport);
        if (sport == null)
        {
            sport = new Sport { SportName = spec.Sport, SportType = spec.SportType, Description = $"{spec.Sport} program" };
            _context.Sports.Add(sport);
            await _context.SaveChangesAsync();
        }
        var metric = await _context.PerformanceMetricDefinitions.FirstOrDefaultAsync(item => item.SportId == sport.SportId);
        if (metric == null)
        {
            var first = spec.Workouts[0];
            metric = new PerformanceMetricDefinition { SportId = sport.SportId, MetricName = first.Workout, Unit = first.Unit.ToLowerInvariant(), Description = $"{first.Workout} for {spec.Sport}" };
            _context.PerformanceMetricDefinitions.Add(metric);
        }
        await _context.SaveChangesAsync();

        var team = new Team { SportId = sport.SportId, CoachId = coach.CoachId, TeamName = spec.Name, SchoolYear = SchoolYear, Status = "ACTIVE" };
        _context.Teams.Add(team);
        await _context.SaveChangesAsync();
        _teams[spec.Key] = new TeamState { Spec = spec, Team = team, Coach = coach, Metric = metric };
        _accounts.Add(("COACH", spec.CoachId, $"{spec.CoachFirst} {spec.CoachLast}", coachUser.Email, "ACTIVE", spec.Name, $"Head coach, {spec.Name}"));
    }

    private async Task CreateAthleteAsync(AthleteSpec spec)
    {
        var status = spec.Id == SuspendedId ? "SUSPENDED" : "ACTIVE";
        var entryYear = 2000 + int.Parse(spec.Id[1..3]);
        var user = NewUser("ATHLETE", spec.Id, spec.First, spec.Last, IdEmail(spec.Id), hiredYear: entryYear, status: status);
        var athlete = new AthleteProfile
        {
            User = user,
            StudentNumber = spec.Id,
            Course = spec.Course,
            YearLevel = spec.Year,
            BirthDate = new DateTime(2007 - spec.Year, 1 + _random.Next(12), 1 + _random.Next(28))
        };
        _context.AthleteProfiles.Add(athlete);
        await _context.SaveChangesAsync();
        _athletes[spec.Id] = athlete;

        foreach (var key in spec.Teams)
        {
            var state = _teams[key];
            var joined = spec.Id == LateJoinerId && key == "tf" ? _today.AddDays(-35) : SemesterStart().AddDays(-_random.Next(0, 300));
            _context.TeamMembers.Add(new TeamMember { TeamId = state.Team.TeamId, AthleteId = athlete.AthleteId, DateJoined = joined });
            state.Members.Add(athlete);
        }
        await _context.SaveChangesAsync();

        var kind = spec.Id[0] == 'T' ? "Transfer" : "Regular";
        var teams = spec.Teams.Length == 0 ? "—" : string.Join(", ", spec.Teams.Select(key => _teams[key].Spec.Name));
        _accounts.Add(("ATHLETE", spec.Id, $"{spec.First} {spec.Last}", user.Email, status, teams, $"{kind}, year {spec.Year}, {spec.Course}{(spec.Note.Length > 0 ? $". {spec.Note}" : string.Empty)}"));
    }

    private async Task CreateParentsAsync()
    {
        foreach (var (first, last, email, children) in Parents)
        {
            var user = NewUser("PARENT", null, first, last, email, hiredYear: 2025);
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            foreach (var (childId, relationship) in children)
            {
                _context.ParentAthletes.Add(new ParentAthlete { ParentUserId = user.UserId, AthleteId = _athletes[childId].AthleteId, Relationship = relationship, CreatedAt = DateTime.UtcNow.AddDays(-60) });
            }
            await _context.SaveChangesAsync();
            var names = string.Join(", ", children.Select(child => $"{_athletes[child.ChildId].User.FirstName} {_athletes[child.ChildId].User.LastName} ({child.Relationship.ToLowerInvariant()})"));
            _accounts.Add(("PARENT", "—", $"{first} {last}", email, "ACTIVE", names, "Sees their child's training and attendance"));
        }
    }

    // ------------------------------------------------------------------ training

    private DateTime SemesterStart() => _today.AddDays(-63);

    private void AddPastTraining(TeamState state)
    {
        var spec = state.Spec;
        var index = 0;
        for (var date = SemesterStart(); date < _today; date = date.AddDays(1))
        {
            if (!spec.Days.Contains(date.DayOfWeek)) continue;
            state.Past.Add(AddSession(state, spec.Titles[index++ % spec.Titles.Length], date, "APPROVED"));
        }
    }

    private TrainingSession AddSession(TeamState state, string title, DateTime date, string status, TimeSpan? start = null, TimeSpan? end = null)
    {
        var spec = state.Spec;
        var session = new TrainingSession
        {
            TeamId = state.Team.TeamId,
            CoachId = state.Coach.CoachId,
            Title = title,
            Description = $"{spec.Name} {title.ToLowerInvariant()}. Bring water and proper training attire.",
            TrainingDate = date.Date,
            StartTime = start ?? spec.Start,
            EndTime = end ?? spec.End,
            Location = spec.Location,
            ApprovalStatus = status,
            SubmittedAt = date.AddDays(-9),
            ReviewedAt = status == "PENDING" ? null : date.AddDays(-7),
            ReviewedBy = status == "PENDING" ? null : _director.UserId,
        };
        _context.TrainingSessions.Add(session);
        return session;
    }

    private void AddAttendanceAndResults()
    {
        foreach (var state in _teams.Values)
        {
            foreach (var athlete in state.Members)
            {
                var id = athlete.StudentNumber;
                var reliability = id == LowAttendanceId ? 0.5 : 0.82 + _random.NextDouble() * 0.16;
                // Stronger athletes start a few steps ahead; everyone improves over the semester.
                var skill = _random.Next(-2, 3);
                var sessions = state.Past.Where(session => !(id == LateJoinerId && state.Spec.Key == "tf" && session.TrainingDate < _today.AddDays(-35))
                    && !(id == SuspendedId && session.TrainingDate >= _today.AddDays(-14))).ToList();
                for (var index = 0; index < sessions.Count; index++)
                {
                    var session = sessions[index];
                    var status = AttendanceStatus(reliability);
                    _context.Attendances.Add(new Attendance
                    {
                        TrainingSessionId = session.TrainingSessionId,
                        AthleteId = athlete.AthleteId,
                        AttendanceStatus = status,
                        Remarks = status == "EXCUSED" ? ExcusedRemarks[_random.Next(ExcusedRemarks.Length)] : null
                    });
                    // Results are tested once a week, at the second session of the week.
                    if (index % 2 == 1 && status is "PRESENT" or "LATE")
                    {
                        var week = index / 2;
                        foreach (var (workout, unit, baseValue, step) in state.Spec.Workouts)
                        {
                            var noise = (decimal)(_random.NextDouble() - 0.5) * Math.Abs(step) * 1.6m;
                            var value = baseValue + step * skill * 2 + step * week + noise;
                            _context.PerformanceRecords.Add(new PerformanceRecord
                            {
                                AthleteId = athlete.AthleteId,
                                MetricId = state.Metric.MetricId,
                                CoachId = state.Coach.CoachId,
                                RecordedValue = Math.Round(value, unit == "SECONDS" ? 2 : workout.Contains("(m)") ? 2 : unit == "PERCENT" ? 1 : 0),
                                RecordedDate = session.TrainingDate,
                                DataType = workout,
                                Unit = unit,
                                SessionId = session.TrainingSessionId,
                                Notes = index >= sessions.Count - 2 ? "Latest weekly test." : null
                            });
                        }
                    }
                }
            }
        }
    }

    private string AttendanceStatus(double reliability)
    {
        var roll = _random.NextDouble();
        if (roll < reliability) return roll < reliability * 0.9 ? "PRESENT" : "LATE";
        return roll < reliability + (1 - reliability) * 0.35 ? "EXCUSED" : "ABSENT";
    }

    /// <summary>
    /// Two weeks of approved sessions, plus requests still waiting for the Director, one rejected request, one
    /// session the coach cancelled, and one the coach moved, each with its reason.
    /// </summary>
    private void AddUpcomingTraining()
    {
        foreach (var state in _teams.Values)
        {
            var index = 0;
            for (var date = _today.AddDays(1); date <= _today.AddDays(14); date = date.AddDays(1))
            {
                if (!state.Spec.Days.Contains(date.DayOfWeek)) continue;
                state.Upcoming.Add(AddSession(state, state.Spec.Titles[index++ % state.Spec.Titles.Length], date, "APPROVED"));
            }
        }

        var football = _teams["fb"].Upcoming[0];
        football.ApprovalStatus = "CANCELLED";
        football.CancellationReason = "Heavy rainfall advisory: the football field is waterlogged and unsafe for training.";
        football.CancelledAt = DateTime.UtcNow.AddDays(-1);

        var swim = _teams["sw"].Upcoming[0];
        swim.TrainingDate = swim.TrainingDate.AddDays(1);
        swim.RescheduleReason = "The pool is closed for maintenance that morning, so the session moves to the next day.";
        swim.RescheduledAt = DateTime.UtcNow.AddDays(-2);

        AddSession(_teams["vb"], "Extra serve and receive drills", _today.AddDays(9), "PENDING", new(8, 0, 0), new(10, 0, 0));
        AddSession(_teams["tf"], "200m time trials", _today.AddDays(10), "PENDING");
        AddSession(_teams["bd"], "Doubles match practice", _today.AddDays(11), "PENDING");
        var rejected = AddSession(_teams["bb"], "Saturday scrimmage", _today.AddDays(8), "REJECTED", new(8, 0, 0), new(11, 0, 0));
        rejected.RejectionReason = "The University Gymnasium is reserved for the Intramurals finals that day. Please choose another date.";
    }

    private void AddEvents()
    {
        Schedule Event(string title, string type, int days, int startHour, int endHour, string location, string description) =>
            new() { Title = title, ScheduleType = type, StartDatetime = _today.AddDays(days).AddHours(startHour), EndDatetime = _today.AddDays(days).AddHours(endHour), Location = location, Description = description, CreatedBy = _director.UserId };

        var friendly = Event("Friendly Volleyball Match", "COMPETITION", 7, 14, 17, "University Gymnasium", "Practice match against a visiting university team.");
        friendly.CancelledAt = DateTime.UtcNow.AddDays(-1);
        friendly.CancellationReason = "The visiting team withdrew because the match clashes with their midterm examinations.";
        var swimMeet = Event("Invitational Swim Meet", "COMPETITION", 19, 7, 15, "Provincial Aquatic Center", "Invitational meet for university swimming teams.");
        swimMeet.RescheduleReason = "The host pool is under maintenance until early November, so the meet moves one week later.";
        swimMeet.RescheduledAt = DateTime.UtcNow.AddDays(-2);

        _context.Schedules.AddRange(
            Event("Athletes' Annual Medical Screening", "SPORTS_EVENT", -38, 8, 12, "University Clinic", "Required yearly screening for every varsity athlete."),
            Event("University Intramurals Opening Ceremony", "SPORTS_EVENT", -24, 8, 11, "University Oval", "Parade of teams and lighting of the torch."),
            Event("Sports Leadership Seminar", "SPORTS_EVENT", 5, 13, 16, "Audio-Visual Room, Main Building", "Seminar for team captains and officers."),
            Event("Inter-Collegiate Basketball League — Opening Game", "COMPETITION", 9, 15, 18, "University Gymnasium", "Season opener of the Inter-Collegiate Basketball League."),
            Event("PRISAA Regional Athletic Meet", "COMPETITION", 16, 7, 17, "Provincial Sports Complex", "Regional qualifier for the national PRISAA games."),
            friendly,
            swimMeet);
    }

    // ------------------------------------------------------------------ portfolio and documents

    private async Task AddPortfolioAsync()
    {
        foreach (var (athleteId, title, category, daysAgo, status, reason) in PortfolioPlan)
        {
            var athlete = _athletes[athleteId];
            var reviewer = status == "PENDING" ? null : TeamOf(athleteId).Coach.User;
            var submitted = DateTime.UtcNow.AddDays(-daysAgo + 2);
            var reviewed = status == "PENDING" ? (DateTime?)null : submitted.AddDays(2);
            var achievement = new Achievement
            {
                AthleteId = athlete.AthleteId,
                Title = title,
                Description = "Certificate attached as proof.",
                AchievementDate = _today.AddDays(-daysAgo),
                Category = category,
                VerificationStatus = status,
                VerifiedBy = reviewer?.UserId,
                VerifiedAt = reviewed,
                RejectionReason = reason,
                CreatedAt = submitted
            };
            _context.Achievements.Add(achievement);
            await _context.SaveChangesAsync();

            var fileName = $"{FilePrefix}{Guid.NewGuid():N}.pdf";
            WriteFile("documents", fileName, PlaceholderPdf($"Certificate - {title}"));
            _context.Documents.Add(new Document
            {
                AthleteId = athlete.AthleteId,
                AchievementId = achievement.AchievementId,
                DocumentType = "Achievement Evidence",
                Title = title,
                DocumentName = "certificate.pdf",
                FileUrl = $"documents/{fileName}",
                Status = status switch { "VERIFIED" => "APPROVED", "REJECTED" => "REJECTED", _ => "PENDING" },
                UploadedAt = submitted
            });
            _context.PortfolioItems.Add(new PortfolioItem
            {
                AthleteId = athlete.AthleteId,
                AchievementId = achievement.AchievementId,
                Title = title,
                Description = achievement.Description,
                DisplayOrder = 0,
                IsVisible = true,
                CreatedAt = submitted,
                VerificationStatus = status,
                VerifiedBy = reviewer?.UserId,
                VerifiedAt = reviewed,
                RejectionReason = reason
            });
        }
    }

    private void AddDocuments()
    {
        string[] noClearance = ["T26-35880", "A25-34948", "A26-36302"];
        foreach (var spec in Athletes)
        {
            var athlete = _athletes[spec.Id];
            if (!noClearance.Contains(spec.Id)) AddDocument(athlete, "Medical Clearance", 30 + _random.Next(30));
            if (_random.NextDouble() < 0.6) AddDocument(athlete, "Consent Form", 25 + _random.Next(30));
            if (_random.NextDouble() < 0.3) AddDocument(athlete, "Athletic Eligibility Form", 20 + _random.Next(30));
        }
    }

    private void AddDocument(AthleteProfile athlete, string type, int daysAgo)
    {
        var fileName = $"{FilePrefix}{Guid.NewGuid():N}.pdf";
        WriteFile("documents", fileName, PlaceholderPdf($"{type} - {athlete.StudentNumber} - {athlete.User.FirstName} {athlete.User.LastName}"));
        _context.Documents.Add(new Document
        {
            AthleteId = athlete.AthleteId,
            DocumentType = type,
            Title = $"{type} {SchoolYear}",
            DocumentName = $"{type.Replace(' ', '_')}_{athlete.StudentNumber}.pdf",
            FileUrl = $"documents/{fileName}",
            Status = "APPROVED",
            UploadedAt = DateTime.UtcNow.AddDays(-daysAgo)
        });
    }

    // ------------------------------------------------------------------ notifications and evaluations

    /// <summary>What each person would have been told over the past weeks; anything older than two days is read.</summary>
    private void AddNotifications()
    {
        var athletesAndCoaches = _athletes.Values.Where(athlete => athlete.User.AccountStatus == "ACTIVE").Select(athlete => athlete.UserId)
            .Concat(_teams.Values.Select(state => state.Coach.UserId)).ToList();
        string When(DateTime date, TimeSpan? time) => $"{date:MMM d, yyyy}{(time.HasValue ? $" at {DateTime.Today.Add(time.Value):h:mm tt}" : string.Empty)}";

        // Events
        Notify(athletesAndCoaches, "New competition: PRISAA Regional Athletic Meet", $"PRISAA Regional Athletic Meet is scheduled on {When(_today.AddDays(16), new(7, 0, 0))} at Provincial Sports Complex.", "SCHEDULE_CREATED", 12);
        Notify(athletesAndCoaches, "New competition: Inter-Collegiate Basketball League — Opening Game", $"The opening game is scheduled on {When(_today.AddDays(9), new(15, 0, 0))} at University Gymnasium.", "SCHEDULE_CREATED", 8);
        Notify(athletesAndCoaches, "New sports event: Sports Leadership Seminar", $"Sports Leadership Seminar is scheduled on {When(_today.AddDays(5), new(13, 0, 0))} at the Audio-Visual Room, Main Building.", "SCHEDULE_CREATED", 6);
        Notify(athletesAndCoaches, "Competition rescheduled: Invitational Swim Meet", $"Invitational Swim Meet moved from {When(_today.AddDays(12), new(7, 0, 0))} to {When(_today.AddDays(19), new(7, 0, 0))}. Reason: The host pool is under maintenance until early November, so the meet moves one week later.", "SCHEDULE_RESCHEDULED", 2);
        Notify(athletesAndCoaches, "Competition cancelled: Friendly Volleyball Match", $"Friendly Volleyball Match on {When(_today.AddDays(7), new(14, 0, 0))} has been cancelled. Reason: The visiting team withdrew because the match clashes with their midterm examinations.", "SCHEDULE_CANCELLED", 1);

        // Training: weekly approvals, the cancelled and the moved session, requests and the rejection
        foreach (var state in _teams.Values)
        {
            var members = state.Members.Where(athlete => athlete.User.AccountStatus == "ACTIVE").ToList();
            var next = state.Upcoming.FirstOrDefault(session => session.ApprovalStatus == "APPROVED" && session.RescheduledAt == null);
            if (next == null) continue;
            Notify(members.Select(athlete => athlete.UserId), "Training session approved", $"{next.Title} for {state.Team.TeamName} is scheduled on {When(next.TrainingDate, next.StartTime)} at {next.Location}.", "TRAINING_APPROVED", 4);
            Notify([state.Coach.UserId], "Training session approved", $"{next.Title} for {state.Team.TeamName} on {next.TrainingDate:MMM d, yyyy} was approved and is now visible to your athletes.", "TRAINING_APPROVED", 4);
        }

        var football = _teams["fb"];
        var cancelled = football.Upcoming[0];
        var cancelMessage = $"{cancelled.Title} ({football.Team.TeamName}) on {When(cancelled.TrainingDate, cancelled.StartTime)}, {cancelled.Location} has been cancelled. Reason: {cancelled.CancellationReason}";
        Notify(football.Members.Select(athlete => athlete.UserId), "Training session cancelled", cancelMessage, "TRAINING_CANCELLED", 1);
        Notify([_director.UserId], "Training session cancelled", $"Coach {football.Coach.User.FirstName} {football.Coach.User.LastName}: {cancelMessage}", "TRAINING_CANCELLED", 1);

        var swimming = _teams["sw"];
        var moved = swimming.Upcoming[0];
        var moveMessage = $"{moved.Title} ({swimming.Team.TeamName}) moved from {When(moved.TrainingDate.AddDays(-1), moved.StartTime)} to {When(moved.TrainingDate, moved.StartTime)}. Reason: {moved.RescheduleReason}";
        Notify(swimming.Members.Select(athlete => athlete.UserId), "Training session rescheduled", moveMessage, "TRAINING_RESCHEDULED", 2);
        Notify([_director.UserId], "Training session rescheduled", $"Coach {swimming.Coach.User.FirstName} {swimming.Coach.User.LastName}: {moveMessage}", "TRAINING_RESCHEDULED", 2);

        foreach (var (key, title, days) in new[] { ("vb", "Extra serve and receive drills", 1), ("tf", "200m time trials", 1), ("bd", "Doubles match practice", 0) })
        {
            Notify([_director.UserId], "Training session approval requested", $"Coach {_teams[key].Coach.User.LastName} requested {title} for {_teams[key].Team.TeamName}. It is waiting for your approval.", "TRAINING_APPROVAL_REQUEST", days);
        }
        Notify([_teams["bb"].Coach.UserId], "Training session rejected", $"Saturday scrimmage for Men's Varsity Basketball was rejected. Reason: The University Gymnasium is reserved for the Intramurals finals that day. Please choose another date.", "TRAINING_REJECTED", 1);

        // Portfolio
        foreach (var (athleteId, title, _, daysAgo, status, reason) in PortfolioPlan)
        {
            var athlete = _athletes[athleteId];
            var coach = TeamOf(athleteId).Coach;
            var reviewedDaysAgo = Math.Max(0, daysAgo - 4);
            if (status == "PENDING")
                Notify([coach.UserId], "New portfolio submission", $"{athlete.User.FirstName} {athlete.User.LastName} submitted \"{title}\" for verification.", "PORTFOLIO_SUBMITTED", Math.Max(0, daysAgo - 2));
            else if (status == "VERIFIED")
                Notify([athlete.UserId], "Portfolio verified", $"Your portfolio submission \"{title}\" was verified by your coach.", "PORTFOLIO_VERIFIED", reviewedDaysAgo);
            else
                Notify([athlete.UserId], "Portfolio rejected", $"Your portfolio submission \"{title}\" was rejected by your coach. Reason: {reason}", "PORTFOLIO_REJECTED", reviewedDaysAgo);
        }

        // Parents: the latest attendance and the next session for each child
        foreach (var (_, _, email, children) in Parents)
        {
            var parent = _context.Users.Local.First(user => user.Email == email);
            foreach (var (childId, _) in children)
            {
                var child = _athletes[childId];
                var state = TeamOf(childId);
                var last = state.Past[^1];
                var status = _context.Attendances.Local.FirstOrDefault(row => row.AthleteId == child.AthleteId && row.TrainingSessionId == last.TrainingSessionId)?.AttendanceStatus ?? "PRESENT";
                Notify([parent.UserId], "Training attendance recorded", $"{child.User.FirstName} was marked {status.ToLowerInvariant()} for {last.Title} on {last.TrainingDate:MMM d, yyyy}.", "TRAINING_ATTENDANCE", (_today - last.TrainingDate).Days);
                var next = state.Upcoming.FirstOrDefault(session => session.ApprovalStatus == "APPROVED");
                if (next != null)
                    Notify([parent.UserId], "New training session", $"{child.User.FirstName} has a new training session: {next.Title} ({state.Team.TeamName}) on {When(next.TrainingDate, next.StartTime)}, {next.Location}.", "TRAINING_APPROVED", 4);
            }
        }
    }

    /// <summary>
    /// About two thirds of the students have already answered the coach evaluation sent with the latest grades;
    /// the demo student and the rest still have it waiting on their dashboards.
    /// </summary>
    private async Task AnswerSomeEvaluationsAsync()
    {
        var demoAthleteId = _athletes[DemoStudentId].AthleteId;
        var evaluations = await _context.CoachEvaluations.Include(evaluation => evaluation.Athlete).OrderBy(evaluation => evaluation.CoachEvaluationId).ToListAsync();
        foreach (var (evaluation, index) in evaluations.Select((evaluation, index) => (evaluation, index)))
        {
            if (evaluation.AthleteId == demoAthleteId || index % 3 == 2) continue;
            var leaning = 3.6 + _random.NextDouble() * 1.4;
            var ratings = CoachEvaluationService.Questions.ToDictionary(
                question => question.Key,
                _ => Math.Clamp((int)Math.Round(leaning + (_random.NextDouble() - 0.5) * 1.6), 2, 5));
            evaluation.Ratings = JsonSerializer.Serialize(ratings);
            evaluation.Comments = _random.NextDouble() < 0.6 ? EvaluationComments[_random.Next(EvaluationComments.Length)] : null;
            evaluation.Status = "SUBMITTED";
            evaluation.SubmittedAt = (evaluation.SentAt ?? DateTime.UtcNow).AddHours(2 + _random.Next(30));

            // Their "Evaluate your coach" notification has been read.
            await _context.Notifications
                .Where(notification => notification.UserId == evaluation.Athlete.UserId && notification.NotificationType == "COACH_EVALUATION")
                .ExecuteUpdateAsync(set => set.SetProperty(notification => notification.IsRead, true));
        }
        await _context.SaveChangesAsync();
    }

    // ------------------------------------------------------------------ helpers

    private static string IdEmail(string id) => id + Domain;

    private User NewUser(string role, string? universityId, string firstName, string lastName, string email, int hiredYear, string status = "ACTIVE") => new()
    {
        RoleId = _roles[role],
        UniversityId = universityId,
        Email = email,
        PasswordHash = _passwordHash,
        FirstName = firstName,
        LastName = lastName,
        Phone = $"09{_random.Next(15, 99)} {_random.Next(100, 999)} {_random.Next(1000, 9999)}",
        AccountStatus = status,
        // Accounts were opened when the person joined the school, but never before the system existed.
        CreatedAt = new DateTime(Math.Max(hiredYear, 2025), 6, 1, 0, 0, 0, DateTimeKind.Utc)
    };

    private TeamState TeamOf(string athleteId) => _teams[Athletes.First(spec => spec.Id == athleteId).Teams[0]];

    private void Notify(IEnumerable<int> userIds, string title, string message, string type, int daysAgo)
    {
        var createdAt = DateTime.UtcNow.AddDays(-daysAgo).AddHours(-_random.Next(1, 8));
        foreach (var userId in userIds.Distinct())
        {
            _context.Notifications.Add(new Notification { UserId = userId, Title = title, Message = message, NotificationType = type, IsRead = daysAgo > 2, CreatedAt = createdAt });
        }
    }

    private void WriteFile(string folder, string fileName, byte[] content)
    {
        var directory = Path.Combine(_contentRoot, "private-uploads", folder);
        Directory.CreateDirectory(directory);
        File.WriteAllBytes(Path.Combine(directory, fileName), content);
    }

    /// <summary>Writes the demo account list as Markdown in the database folder (or the content root if it is missing).</summary>
    private string WriteAccountList()
    {
        var databaseFolder = Path.GetFullPath(Path.Combine(_contentRoot, "..", "..", "database"));
        var path = Path.Combine(Directory.Exists(databaseFolder) ? databaseFolder : _contentRoot, "DEMO_ACCOUNTS.md");
        var builder = new StringBuilder();
        builder.AppendLine("# Demo accounts");
        builder.AppendLine();
        builder.AppendLine("Created by `dotnet run -- --reset-demo-data` (see `Data/DemoDataSeeder.cs`). Dates are relative to the day the data was created.");
        builder.AppendLine();
        builder.AppendLine($"**Password for every account: `{Password}`.** Student IDs: `A` regular / `T` transfer, then the year the student entered, then the student number. Staff: `C` coach, `D` Sports Director, then the year hired.");
        foreach (var (role, heading, teamHeading) in new[] { ("DIRECTOR", "Sports Director", "Team"), ("COACH", "Coaches", "Team"), ("ATHLETE", "Student-athletes", "Team"), ("PARENT", "Parents", "Linked children") })
        {
            builder.AppendLine();
            builder.AppendLine($"## {heading}");
            builder.AppendLine();
            builder.AppendLine($"| ID | Name | Email (sign-in) | Status | {teamHeading} | Notes |");
            builder.AppendLine("|---|---|---|---|---|---|");
            foreach (var row in _accounts.Where(row => row.Role == role))
            {
                builder.AppendLine($"| {row.Id} | {row.Name} | `{row.Email}` | {row.Status} | {row.Team} | {row.Note} |");
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
        var stream = $"BT /F1 16 Tf 72 720 Td ({ascii}) Tj ET";
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
