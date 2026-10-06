using System.Text;
using System.Text.Json;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Data;

/// <summary>
/// Development-only scenario data for manual testing: active, suspended, inactive, and former athletes,
/// transfers, multi-sport athletes, every eligibility outcome, and approval workflows in each state.
///
///   dotnet run -- --seed-test-data     (re-creates the scenarios; earlier seed data is removed first)
///   dotnet run -- --remove-test-data   (deletes only seed data)
///
/// Seed rows are identifiable by the @seed.athletehub.test email domain and the "[Seed]" title prefix,
/// so removal never touches real records. Every seeded account uses the password <see cref="Password"/>.
/// </summary>
public class TestDataSeeder
{
    public const string Password = "Seed123!";
    private const string EmailDomain = "@seed.athletehub.test";
    private const string Prefix = "[Seed] ";
    private const string FilePrefix = "seed-";

    private readonly AthleteHubDbContext _context;
    private readonly string _contentRoot;
    private readonly DateTime _today;
    private readonly string _passwordHash = BCrypt.Net.BCrypt.HashPassword(Password);

    public TestDataSeeder(AthleteHubDbContext context, AppClock clock, IWebHostEnvironment environment)
    {
        _context = context;
        _contentRoot = environment.ContentRootPath;
        _today = clock.LocalToday;
    }

    public async Task RemoveAsync()
    {
        var userIds = await _context.Users.Where(user => user.Email.EndsWith(EmailDomain)).Select(user => user.UserId).ToListAsync();
        var athleteIds = await _context.AthleteProfiles.Where(athlete => userIds.Contains(athlete.UserId)).Select(athlete => athlete.AthleteId).ToListAsync();
        var coachIds = await _context.CoachProfiles.Where(coach => userIds.Contains(coach.UserId)).Select(coach => coach.CoachId).ToListAsync();
        var teamIds = await _context.Teams.Where(team => team.TeamName.StartsWith(Prefix)).Select(team => team.TeamId).ToListAsync();
        var sessionIds = await _context.TrainingSessions.Where(session => teamIds.Contains(session.TeamId)).Select(session => session.TrainingSessionId).ToListAsync();

        // Real records may point at seed staff (e.g. a seed coach reviewed something); detach those first.
        int? none = null;
        await _context.Achievements.Where(item => item.VerifiedBy != null && userIds.Contains(item.VerifiedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.VerifiedBy, none));
        await _context.PortfolioItems.Where(item => item.VerifiedBy != null && userIds.Contains(item.VerifiedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.VerifiedBy, none));
        await _context.EligibilityRecords.Where(item => item.RequestedBy != null && userIds.Contains(item.RequestedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.RequestedBy, none));
        await _context.EligibilityRecords.Where(item => item.UploadedBy != null && userIds.Contains(item.UploadedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.UploadedBy, none));
        await _context.EligibilityRecords.Where(item => item.ReviewedBy != null && userIds.Contains(item.ReviewedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.ReviewedBy, none));
        await _context.TrainingSessions.Where(item => item.ReviewedBy != null && userIds.Contains(item.ReviewedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.ReviewedBy, none));
        await _context.Schedules.Where(item => item.CreatedBy != null && userIds.Contains(item.CreatedBy.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.CreatedBy, none));
        await _context.PerformanceRecords.Where(item => item.CoachId != null && coachIds.Contains(item.CoachId.Value)).ExecuteUpdateAsync(set => set.SetProperty(item => item.CoachId, none));

        // Delete children before parents; each step only matches rows owned by seed users or seed teams.
        await _context.Attendances.Where(item => athleteIds.Contains(item.AthleteId) || sessionIds.Contains(item.TrainingSessionId)).ExecuteDeleteAsync();
        await _context.PerformanceRecords.Where(item => athleteIds.Contains(item.AthleteId)).ExecuteDeleteAsync();
        await _context.EligibilityRecords.Where(item => athleteIds.Contains(item.AthleteId)).ExecuteDeleteAsync();
        await _context.PortfolioItems.Where(item => athleteIds.Contains(item.AthleteId)).ExecuteDeleteAsync();
        await _context.Documents.Where(item => athleteIds.Contains(item.AthleteId)).ExecuteDeleteAsync();
        await _context.Achievements.Where(item => athleteIds.Contains(item.AthleteId)).ExecuteDeleteAsync();
        await _context.TrainingSessions.Where(item => sessionIds.Contains(item.TrainingSessionId)).ExecuteDeleteAsync();
        await _context.TeamMembers.Where(item => athleteIds.Contains(item.AthleteId) || teamIds.Contains(item.TeamId)).ExecuteDeleteAsync();
        await _context.Teams.Where(item => teamIds.Contains(item.TeamId)).ExecuteDeleteAsync();
        await _context.Schedules.Where(item => item.Title.StartsWith(Prefix)).ExecuteDeleteAsync();
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

    public async Task SeedAsync()
    {
        await RemoveAsync();
        await using var transaction = await _context.Database.BeginTransactionAsync();

        var roles = await _context.Roles.ToDictionaryAsync(role => role.RoleName, role => role.RoleId);
        var director = await _context.Users.FirstOrDefaultAsync(user => user.Role.RoleName == "DIRECTOR" && user.AccountStatus == "ACTIVE");
        var registrar = await _context.Users.FirstOrDefaultAsync(user => user.Role.RoleName == "REGISTRAR" && user.AccountStatus == "ACTIVE");

        var basketball = await GetOrCreateSportAsync("Basketball", "TEAM");
        var volleyball = await GetOrCreateSportAsync("Volleyball", "TEAM");
        var swimming = await GetOrCreateSportAsync("Swimming", "INDIVIDUAL");
        var basketballMetric = await GetOrCreateMetricAsync(basketball, "Vertical Jump", "cm");
        var volleyballMetric = await GetOrCreateMetricAsync(volleyball, "Serve Accuracy", "percent");
        var firstSem = await GetOrCreateTermAsync("2026-2027", "1st Semester");
        var secondSem = await GetOrCreateTermAsync("2026-2027", "2nd Semester");

        // ---------------- Coaches ----------------
        var santos = await CreateCoachAsync(roles, "SEED-C-001", "Maria", "Santos", "ACTIVE", "Basketball");
        var cruz = await CreateCoachAsync(roles, "SEED-C-002", "Ramon", "Cruz", "ACTIVE", "Volleyball");
        var reyesCoach = await CreateCoachAsync(roles, "SEED-C-003", "Paolo", "Reyes", "INACTIVE", "Swimming"); // left the school
        await CreateCoachAsync(roles, "SEED-C-004", "Liza", "Mendoza", "ACTIVE", "Track and Field");            // no team yet

        var eagles = AddTeam(basketball, santos, "Blue Eagles Basketball", "ACTIVE");
        var spikers = AddTeam(volleyball, cruz, "Lady Spikers Volleyball", "ACTIVE");
        var sharks = AddTeam(swimming, reyesCoach, "Sharks Swimming", "INACTIVE");                             // disbanded team
        await _context.SaveChangesAsync();

        // ---------------- Athletes ----------------
        // Each tuple: scenario label, account status. Comments describe what the scenario exercises.
        var juan = await CreateAthleteAsync(roles, "SEED-A-001", "Juan", "Dela Cruz", "ACTIVE", "BS Computer Science", 3);       // model athlete
        var ana = await CreateAthleteAsync(roles, "SEED-A-002", "Ana", "Reyes", "ACTIVE", "BS Accountancy", 2);                 // ineligible
        var mark = await CreateAthleteAsync(roles, "SEED-A-003", "Mark", "Villanueva", "ACTIVE", "BS Civil Engineering", 1);    // evaluation pending
        var carla = await CreateAthleteAsync(roles, "SEED-A-004", "Carla", "Bautista", "SUSPENDED", "BS Nursing", 2);           // suspended, still on roster
        var miguel = await CreateAthleteAsync(roles, "SEED-A-005", "Miguel", "Torres", "INACTIVE", "BS Psychology", 4);         // left the school
        var sofia = await CreateAthleteAsync(roles, "SEED-A-006", "Sofia", "Garcia", "ACTIVE", "BA Communication", 3);          // quit the team, still a student
        var daniel = await CreateAthleteAsync(roles, "SEED-A-007", "Daniel", "Ramos", "ACTIVE", "BS Architecture", 2);          // transferred teams
        var bea = await CreateAthleteAsync(roles, "SEED-A-008", "Bea", "Lim", "ACTIVE", "BS Biology", 1);                       // new, unassigned
        var kevin = await CreateAthleteAsync(roles, "SEED-A-009", "Kevin", "Aquino", "ACTIVE", "BS Information Technology", 3);  // two sports
        var jasmine = await CreateAthleteAsync(roles, "SEED-A-010", "Jasmine", "Flores", "ACTIVE", "BS Education", 4);         // at-risk attendance, recovered eligibility

        // ---------------- Team membership ----------------
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

        // ---------------- Training sessions & attendance ----------------
        var eaglesPast = new List<TrainingSession>();
        for (var week = 6; week >= 1; week--)
        {
            eaglesPast.Add(AddSession(eagles, santos, $"Shooting drills — week {7 - week}", _today.AddDays(-7 * week), "APPROVED", director));
        }
        var spikersPast = new List<TrainingSession>();
        for (var week = 6; week >= 1; week--)
        {
            spikersPast.Add(AddSession(spikers, cruz, $"Serve and receive — week {7 - week}", _today.AddDays(-7 * week + 1), "APPROVED", director));
        }
        AddSession(eagles, santos, "Full-court scrimmage", _today.AddDays(2), "APPROVED", director);
        AddSession(spikers, cruz, "Blocking clinic", _today.AddDays(3), "APPROVED", director);
        AddSession(eagles, santos, "Conditioning (awaiting approval)", _today.AddDays(5), "PENDING", null);
        AddSession(spikers, cruz, "Weekend tune-up (awaiting approval)", _today.AddDays(6), "PENDING", null);
        AddSession(eagles, santos, "Late-night practice (rejected)", _today.AddDays(4), "REJECTED", director, "Gym is closed after 9 PM.");
        AddSession(sharks, reyesCoach, "Lap swim (old team)", _today.AddMonths(-13), "APPROVED", director);
        await _context.SaveChangesAsync();

        string[] good = ["PRESENT", "PRESENT", "PRESENT", "LATE", "PRESENT", "PRESENT"];
        string[] poor = ["ABSENT", "PRESENT", "ABSENT", "ABSENT", "EXCUSED", "ABSENT"];
        string[] fading = ["PRESENT", "PRESENT", "LATE", "ABSENT", "ABSENT", "ABSENT"];
        MarkAttendance(eaglesPast, juan, good);
        MarkAttendance(eaglesPast, kevin, ["PRESENT", "LATE", "PRESENT", "PRESENT", "ABSENT", "PRESENT"]);
        MarkAttendance(eaglesPast, carla, ["PRESENT", "PRESENT", "ABSENT", "ABSENT", "ABSENT", "ABSENT"]);
        MarkAttendance(eaglesPast.Take(5).ToList(), miguel, ["PRESENT", "PRESENT", "LATE", "PRESENT", "PRESENT"]);
        MarkAttendance(eaglesPast.Take(2).ToList(), mark, ["PRESENT", "PRESENT"]);
        MarkAttendance(eaglesPast.Skip(4).ToList(), daniel, ["PRESENT", "PRESENT"]);
        MarkAttendance(spikersPast, ana, ["PRESENT", "LATE", "PRESENT", "PRESENT", "PRESENT", "LATE"]);
        MarkAttendance(spikersPast, jasmine, poor);
        MarkAttendance(spikersPast.Take(4).ToList(), sofia, fading.Take(4).ToArray());
        MarkAttendance(spikersPast.Take(3).ToList(), daniel, ["PRESENT", "ABSENT", "PRESENT"]);
        MarkAttendance(spikersPast, kevin, ["PRESENT", "PRESENT", "PRESENT", "PRESENT", "LATE", "PRESENT"]);

        // ---------------- Performance (improving, declining, and multi-workout trends) ----------------
        AddPerformance(juan, basketballMetric, santos, eaglesPast, "Vertical Jump", "NUMBER", [48, 50, 51, 53, 54, 56]);
        AddPerformance(juan, basketballMetric, santos, eaglesPast, "Sprint 20m", "SECONDS", [3.6m, 3.55m, 3.5m, 3.48m, 3.4m, 3.38m]);
        AddPerformance(kevin, basketballMetric, santos, eaglesPast, "Vertical Jump", "NUMBER", [44, 45, 45, 46, 45, 47]);
        AddPerformance(carla, basketballMetric, santos, eaglesPast.Take(2).ToList(), "Vertical Jump", "NUMBER", [40, 41]);
        AddPerformance(ana, volleyballMetric, cruz, spikersPast, "Serve Accuracy", "PERCENT", [62, 65, 70, 68, 74, 78]);
        AddPerformance(jasmine, volleyballMetric, cruz, spikersPast.Take(2).ToList(), "Serve Accuracy", "PERCENT", [55, 51]);
        AddPerformance(sofia, volleyballMetric, cruz, spikersPast.Take(3).ToList(), "Serve Accuracy", "PERCENT", [80, 76, 71]);
        await _context.SaveChangesAsync();

        // ---------------- Academic eligibility (every Registrar outcome) ----------------
        var directorId = director?.UserId;
        var registrarId = registrar?.UserId;
        await AddEligibilityAsync(juan, firstSem, "ELIGIBLE", [], "Good standing.", directorId, registrarId, daysAgo: 120);
        await AddEligibilityAsync(juan, secondSem, "ELIGIBLE", [], null, directorId, registrarId, daysAgo: 10);
        await AddEligibilityAsync(ana, secondSem, "INELIGIBLE", ["Failing Grades"], "Two failing grades in major subjects; may re-apply next term.", directorId, registrarId, daysAgo: 8);
        await AddEligibilityAsync(mark, secondSem, "PENDING", [], null, directorId, null, daysAgo: 3, withPdf: false);           // waiting for PDF
        await AddEligibilityAsync(kevin, secondSem, "PENDING", [], null, directorId, registrarId, daysAgo: 4);                   // PDF uploaded, awaiting decision
        await AddEligibilityAsync(carla, firstSem, "INELIGIBLE", ["Incomplete Academic Requirement", "Other"], "Incomplete requirements; account suspended pending review.", directorId, registrarId, daysAgo: 100);
        await AddEligibilityAsync(miguel, firstSem, "ELIGIBLE", [], "Final term before leaving the university.", directorId, registrarId, daysAgo: 130);
        await AddEligibilityAsync(sofia, firstSem, "ELIGIBLE", [], null, directorId, registrarId, daysAgo: 125);
        await AddEligibilityAsync(jasmine, firstSem, "INELIGIBLE", ["Academic Requirement Not Met"], "Below required units.", directorId, registrarId, daysAgo: 118);
        await AddEligibilityAsync(jasmine, secondSem, "ELIGIBLE", [], "Requirement completed; eligibility restored.", directorId, registrarId, daysAgo: 6);
        await AddEligibilityAsync(daniel, secondSem, "ELIGIBLE", [], null, directorId, registrarId, daysAgo: 15);

        // ---------------- Portfolio (verified, rejected, pending) and documents ----------------
        await AddAchievementAsync(juan, "Regional Basketball Championship — 1st place", "Competition", -60, "VERIFIED", santos);
        await AddAchievementAsync(juan, "Team captain, 2026-2027", "Leadership", -30, "PENDING", null);
        await AddAchievementAsync(ana, "Inter-school volleyball tournament MVP", "Award", -45, "REJECTED", cruz, "Certificate is unreadable; please upload a clearer copy.");
        await AddAchievementAsync(mark, "City youth league rookie of the year", "Award", -15, "PENDING", null);
        await AddAchievementAsync(sofia, "PRISAA volleyball qualifier", "Competition", -90, "VERIFIED", cruz);
        await AddAchievementAsync(miguel, "Varsity athlete of the year 2025", "Award", -300, "VERIFIED", santos);
        await AddAchievementAsync(kevin, "Two-sport varsity letter", "Award", -20, "PENDING", null);

        AddDocument(juan, "Medical Clearance", "APPROVED", -40);
        AddDocument(mark, "Medical Clearance", "PENDING", -5);
        AddDocument(mark, "Consent Form", "PENDING", -5);
        AddDocument(jasmine, "Enrollment Form", "PENDING", -2);
        AddDocument(carla, "Athletic Eligibility Form", "REJECTED", -50);
        AddDocument(bea, "Medical Clearance", "PENDING", -1);
        await _context.SaveChangesAsync();

        // ---------------- Schedules ----------------
        _context.Schedules.AddRange(
            new Schedule { Title = Prefix + "UAAP Basketball Opener", ScheduleType = "COMPETITION", StartDatetime = _today.AddDays(9).AddHours(15), EndDatetime = _today.AddDays(9).AddHours(18), Location = "Main Arena", CreatedBy = directorId, Description = "Season opener against rival school." },
            new Schedule { Title = Prefix + "Intramurals Volleyball Finals", ScheduleType = "SPORTS_EVENT", StartDatetime = _today.AddDays(12).AddHours(9), EndDatetime = _today.AddDays(12).AddHours(12), Location = "Covered Court", CreatedBy = directorId },
            new Schedule { Title = Prefix + "Athletes' medical screening", ScheduleType = "SPORTS_EVENT", StartDatetime = _today.AddDays(-3).AddHours(8), EndDatetime = _today.AddDays(-3).AddHours(12), Location = "University Clinic", CreatedBy = directorId });

        // ---------------- Notifications ----------------
        Notify(juan.UserId, "Training session approved", "Full-court scrimmage was approved and added to your schedule.", "TRAINING_APPROVED", read: false);
        Notify(ana.UserId, "Portfolio rejected", "Your submission \"Inter-school volleyball tournament MVP\" was rejected. Reason: certificate is unreadable.", "PORTFOLIO_REJECTED", read: false);
        Notify(santos.UserId, "Training session rejected", "Late-night practice was rejected. Reason: Gym is closed after 9 PM.", "TRAINING_REJECTED", read: false);
        if (registrarId.HasValue) Notify(registrarId.Value, Prefix + "Grade evaluation requested", "A grade evaluation was requested for Mark Villanueva (2026-2027, 2nd Semester).", "GRADE_EVALUATION_REQUEST", read: false);
        if (directorId.HasValue) Notify(directorId.Value, Prefix + "Training session approval requested", "Conditioning for Blue Eagles Basketball is waiting for approval.", "TRAINING_APPROVAL_REQUEST", read: false);

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        Console.WriteLine($"""
            Seeded test scenarios (password for every account: {Password})
              Coaches:  maria.santos (Basketball), ramon.cruz (Volleyball), paolo.reyes (INACTIVE, disbanded swim team), liza.mendoza (no team)
              Athletes: juan.delacruz      active, eligible, verified achievement, improving performance
                        ana.reyes          INELIGIBLE (failing grades), rejected portfolio item
                        mark.villanueva    evaluation requested, waiting for Registrar PDF; documents pending
                        carla.bautista     SUSPENDED account but still on the basketball roster
                        miguel.torres      INACTIVE account (left school), removed from team
                        sofia.garcia       quit volleyball 20 days ago, still an active student
                        daniel.ramos       transferred from volleyball to basketball
                        bea.lim            new athlete with no team
                        kevin.aquino       plays basketball and volleyball; PDF uploaded, awaiting decision
                        jasmine.flores     poor attendance; ineligible last term, eligible again this term
              Emails are <first>.<last>{EmailDomain} (e.g. juan.delacruz{EmailDomain}).
            """);
        if (director == null) Console.WriteLine("Note: no active DIRECTOR account was found, so approvals have no reviewer.");
        if (registrar == null) Console.WriteLine("Note: no active REGISTRAR account was found, so evaluations have no uploader.");
    }

    // ------------------------------------------------------------------ helpers

    private static string EmailFor(string firstName, string lastName) =>
        $"{firstName}.{lastName.Replace(" ", string.Empty)}".ToLowerInvariant() + EmailDomain;

    private async Task<Sport> GetOrCreateSportAsync(string name, string type)
    {
        var sport = await _context.Sports.FirstOrDefaultAsync(item => item.SportName == name);
        if (sport != null) return sport;
        sport = new Sport { SportName = name, SportType = type, Description = $"{name} program" };
        _context.Sports.Add(sport);
        await _context.SaveChangesAsync();
        return sport;
    }

    private async Task<PerformanceMetricDefinition> GetOrCreateMetricAsync(Sport sport, string name, string unit)
    {
        var metric = await _context.PerformanceMetricDefinitions.FirstOrDefaultAsync(item => item.SportId == sport.SportId);
        if (metric != null) return metric;
        metric = new PerformanceMetricDefinition { SportId = sport.SportId, MetricName = name, Unit = unit, Description = $"{name} for {sport.SportName}" };
        _context.PerformanceMetricDefinitions.Add(metric);
        await _context.SaveChangesAsync();
        return metric;
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

    private User NewUser(Dictionary<string, int> roles, string role, string universityId, string firstName, string lastName, string status) => new()
    {
        RoleId = roles[role],
        UniversityId = universityId,
        Email = EmailFor(firstName, lastName),
        PasswordHash = _passwordHash,
        FirstName = firstName,
        LastName = lastName,
        Phone = "0917 555 " + universityId[^3..] + "0",
        AccountStatus = status,
        CreatedAt = DateTime.UtcNow.AddMonths(-12)
    };

    private async Task<CoachProfile> CreateCoachAsync(Dictionary<string, int> roles, string universityId, string firstName, string lastName, string status, string specialization)
    {
        var user = NewUser(roles, "COACH", universityId, firstName, lastName, status);
        var coach = new CoachProfile { User = user, Specialization = specialization };
        _context.CoachProfiles.Add(coach);
        await _context.SaveChangesAsync();
        return coach;
    }

    private async Task<AthleteProfile> CreateAthleteAsync(Dictionary<string, int> roles, string universityId, string firstName, string lastName, string status, string course, int yearLevel)
    {
        var user = NewUser(roles, "ATHLETE", universityId, firstName, lastName, status);
        var athlete = new AthleteProfile
        {
            User = user,
            StudentNumber = universityId,
            Course = course,
            YearLevel = yearLevel,
            BirthDate = new DateTime(2006 - yearLevel, 3 + yearLevel, 10 + yearLevel)
        };
        _context.AthleteProfiles.Add(athlete);
        await _context.SaveChangesAsync();
        return athlete;
    }

    private Team AddTeam(Sport sport, CoachProfile coach, string name, string status)
    {
        var team = new Team { SportId = sport.SportId, CoachId = coach.CoachId, TeamName = Prefix + name, SchoolYear = "2026-2027", Status = status };
        _context.Teams.Add(team);
        return team;
    }

    private void AddMember(Team team, AthleteProfile athlete, DateTime joined, DateTime? left = null) =>
        _context.TeamMembers.Add(new TeamMember { TeamId = team.TeamId, AthleteId = athlete.AthleteId, DateJoined = joined, DateLeft = left });

    private TrainingSession AddSession(Team team, CoachProfile coach, string title, DateTime date, string status, User? reviewer, string? rejectionReason = null)
    {
        var session = new TrainingSession
        {
            TeamId = team.TeamId,
            CoachId = coach.CoachId,
            Title = title,
            Description = "Seeded training session.",
            TrainingDate = date.Date,
            StartTime = new TimeSpan(16, 0, 0),
            EndTime = new TimeSpan(18, 0, 0),
            Location = team.TeamName.Contains("Volleyball") ? "Covered Court" : "Gymnasium",
            ApprovalStatus = status,
            SubmittedAt = date.AddDays(-7),
            ReviewedAt = status == "PENDING" ? null : date.AddDays(-6),
            ReviewedBy = status == "PENDING" ? null : reviewer?.UserId,
            RejectionReason = rejectionReason
        };
        _context.TrainingSessions.Add(session);
        return session;
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

    private void AddPerformance(AthleteProfile athlete, PerformanceMetricDefinition metric, CoachProfile coach, IReadOnlyList<TrainingSession> sessions, string workout, string unit, decimal[] values)
    {
        for (var index = 0; index < sessions.Count && index < values.Length; index++)
        {
            _context.PerformanceRecords.Add(new PerformanceRecord
            {
                AthleteId = athlete.AthleteId,
                MetricId = metric.MetricId,
                CoachId = coach.CoachId,
                RecordedValue = values[index],
                RecordedDate = sessions[index].TrainingDate,
                DataType = workout,
                Unit = unit,
                SessionId = sessions[index].TrainingSessionId,
                Notes = index == sessions.Count - 1 ? "Most recent test." : null
            });
        }
    }

    private async Task AddEligibilityAsync(AthleteProfile athlete, AcademicTerm term, string status, string[] reasons, string? remarks,
        int? requestedBy, int? registrarId, int daysAgo, bool withPdf = true)
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
            RequestedBy = requestedBy,
            RequestedAt = DateTime.UtcNow.AddDays(-daysAgo),
            DocumentId = pdf?.DocumentId,
            UploadedBy = pdf == null ? null : registrarId,
            ReviewedBy = decided ? registrarId : null,
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
    }

    private void AddDocument(AthleteProfile athlete, string type, string status, int daysOffset)
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
            Status = status,
            UploadedAt = DateTime.UtcNow.AddDays(daysOffset)
        });
    }

    private void Notify(int userId, string title, string message, string type, bool read) =>
        _context.Notifications.Add(new Notification { UserId = userId, Title = title, Message = message, NotificationType = type, IsRead = read, CreatedAt = DateTime.UtcNow.AddHours(-2) });

    private void WriteFile(string folder, string fileName, byte[] content)
    {
        var directory = Path.Combine(_contentRoot, "private-uploads", folder);
        Directory.CreateDirectory(directory);
        File.WriteAllBytes(Path.Combine(directory, fileName), content);
    }

    /// <summary>A minimal valid one-page PDF showing a line of text, so previews render.</summary>
    private static byte[] PlaceholderPdf(string text)
    {
        var safe = text.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
        var stream = $"BT /F1 16 Tf 72 720 Td (SAMPLE - {safe}) Tj ET";
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
