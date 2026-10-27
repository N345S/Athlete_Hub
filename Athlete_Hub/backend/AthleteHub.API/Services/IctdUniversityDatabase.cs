using System.Text;

namespace AthleteHub.API.Services;

/// <summary>
/// Stand-in for the ICTD university database of grades. Athlete-Hub has no live connection to it yet, so this
/// imitates one: every student's final grades for a term are generated from their student number, program,
/// and year level. The same student and term always return the same grades, the way a real database would.
/// To connect the real ICTD database later, replace <see cref="ReleasedTerms"/> and <see cref="GetFinalGrades"/>
/// with calls to its API; <see cref="IctdGradeSync"/> pulls whatever they report.
/// </summary>
public class IctdUniversityDatabase
{
    public const string SourceSystem = "ICTD University Database";

    public static readonly string[] Semesters = ["1st Semester", "2nd Semester", "Summer"];

    public sealed record SubjectGrade(string SubjectCode, string SubjectName, string SectionCode, decimal Units, decimal? Grade, string Remarks);

    private static readonly (string Code, string Name)[] GeneralEducation =
    [
        ("GE 1", "Understanding the Self"),
        ("GE 2", "Readings in Philippine History"),
        ("GE 3", "The Contemporary World"),
        ("GE 4", "Mathematics in the Modern World"),
        ("GE 5", "Purposive Communication"),
        ("GE 6", "Art Appreciation"),
        ("GE 7", "Science, Technology and Society"),
        ("GE 8", "Ethics"),
    ];

    private static readonly Dictionary<string, (string Code, string Name)[]> ProgramMajors = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Computer Science"] =
        [
            ("CS 111", "Introduction to Computing"), ("CS 112", "Computer Programming 1"), ("CS 121", "Computer Programming 2"),
            ("CS 122", "Discrete Structures"), ("CS 211", "Data Structures and Algorithms"), ("CS 212", "Object-Oriented Programming"),
            ("CS 221", "Computer Architecture"), ("CS 222", "Automata Theory"), ("CS 311", "Operating Systems"),
            ("CS 312", "Software Engineering 1"), ("CS 321", "Software Engineering 2"), ("CS 322", "Thesis 1"),
        ],
        ["Information Technology"] =
        [
            ("IT 111", "Introduction to Computing"), ("IT 112", "Computer Programming 1"), ("IT 121", "Computer Programming 2"),
            ("IT 122", "Discrete Mathematics"), ("IT 211", "Data Structures and Algorithms"), ("IT 212", "Database Management Systems"),
            ("IT 221", "Web Systems and Technologies"), ("IT 222", "Networking 1"), ("IT 311", "Systems Integration and Architecture"),
            ("IT 312", "Information Assurance and Security"), ("IT 321", "Capstone Project 1"), ("IT 322", "Capstone Project 2"),
        ],
    };

    // Philippine grading scale: 1.00 is the highest passing grade, 3.00 the lowest, 5.00 is failed.
    private static readonly decimal[] PassingGrades = [1.00m, 1.25m, 1.50m, 1.75m, 2.00m, 2.25m, 2.50m, 2.75m, 3.00m];
    private static readonly int[] PassingWeights = [3, 8, 14, 18, 18, 15, 11, 8, 5];

    private readonly AppClock _clock;

    public IctdUniversityDatabase(AppClock clock) => _clock = clock;

    /// <summary>
    /// ICTD releases a term's final grades about ten days after the term ends: 1st Semester (August to December)
    /// on 10 January, 2nd Semester (January to May) on 10 June, and Summer (June and July) on 10 August.
    /// </summary>
    public static DateTime GradesReleasedOn(int startYear, string semester) => semester switch
    {
        "1st Semester" => new DateTime(startYear + 1, 1, 10),
        "2nd Semester" => new DateTime(startYear + 1, 6, 10),
        _ => new DateTime(startYear + 1, 8, 10),
    };

    /// <summary>The <paramref name="count"/> most recent terms whose final grades ICTD has released, newest first.</summary>
    public IReadOnlyList<(string AcademicYear, string Semester)> ReleasedTerms(int count)
    {
        var today = _clock.LocalToday;
        var terms = new List<(string AcademicYear, string Semester)>();
        for (var startYear = today.Year; terms.Count < count; startYear--)
        {
            for (var index = Semesters.Length - 1; index >= 0 && terms.Count < count; index--)
            {
                if (GradesReleasedOn(startYear, Semesters[index]) <= today)
                    terms.Add(($"{startYear}-{startYear + 1}", Semesters[index]));
            }
        }
        return terms;
    }

    /// <summary>The next <paramref name="count"/> terms whose final grades are not released yet, soonest first.</summary>
    public IReadOnlyList<(string AcademicYear, string Semester, DateTime ReleasesOn)> UpcomingTerms(int count)
    {
        var today = _clock.LocalToday;
        var terms = new List<(string AcademicYear, string Semester, DateTime ReleasesOn)>();
        // Within a school year the terms are released in order: 1st Semester, 2nd Semester, then Summer.
        for (var startYear = today.Year - 1; terms.Count < count; startYear++)
        {
            foreach (var semester in Semesters)
            {
                var releasesOn = GradesReleasedOn(startYear, semester);
                if (releasesOn > today && terms.Count < count) terms.Add(($"{startYear}-{startYear + 1}", semester, releasesOn));
            }
        }
        return terms;
    }

    /// <summary>The student's final grades for one term, as the ICTD database reports them.</summary>
    public IReadOnlyList<SubjectGrade> GetFinalGrades(string studentNumber, string? course, int? yearLevel, string academicYear, string semester)
    {
        var random = new Random(StableSeed($"{studentNumber}|{academicYear}|{semester}"));
        var year = Math.Clamp(yearLevel ?? 1, 1, 5);
        var semesterIndex = Array.IndexOf(Semesters, semester);
        var (programCode, majors) = ProgramFor(course);
        var section = $"{programCode}-{year}{(char)('A' + random.Next(4))}";

        var subjects = new List<(string Code, string Name, decimal Units)>();
        if (semesterIndex == 2)
        {
            // Summer classes are short: one major subject and one general education subject.
            var summerMajor = Pick(majors, year * 2 + random.Next(2));
            subjects.Add((summerMajor.Code, summerMajor.Name, 3m));
            var summerGe = GeneralEducation[random.Next(GeneralEducation.Length)];
            subjects.Add((summerGe.Code, summerGe.Name, 3m));
        }
        else
        {
            var termNumber = (year - 1) * 2 + semesterIndex;
            for (var index = 0; index < 3; index++)
            {
                var major = Pick(majors, termNumber * 3 + index);
                subjects.Add((major.Code, major.Name, 3m));
            }
            for (var index = 0; index < 3; index++)
            {
                var ge = GeneralEducation[(termNumber * 3 + index) % GeneralEducation.Length];
                subjects.Add((ge.Code, ge.Name, 3m));
            }
            if (termNumber < 4) subjects.Add(($"PATHFit {termNumber + 1}", "Physical Activity Towards Health and Fitness", 2m));
            if (termNumber < 2) subjects.Add(($"NSTP {termNumber + 1}", "National Service Training Program", 3m));
        }

        return subjects
            .DistinctBy(subject => subject.Code)
            .Select(subject =>
            {
                var roll = random.Next(100);
                if (roll < 3) return new SubjectGrade(subject.Code, subject.Name, section, subject.Units, null, "INC");
                if (roll < 7) return new SubjectGrade(subject.Code, subject.Name, section, subject.Units, 5.00m, "FAILED");
                return new SubjectGrade(subject.Code, subject.Name, section, subject.Units, WeightedPassingGrade(random), "PASSED");
            })
            .ToList();
    }

    private static (string Code, string Name) Pick((string Code, string Name)[] list, int index) => list[index % list.Length];

    /// <summary>
    /// The program's block code (BSIT, BSCS, BSA, ...) and its major subjects. Programs without a listed
    /// curriculum get general major subjects named after the field.
    /// </summary>
    private static (string ProgramCode, (string Code, string Name)[] Majors) ProgramFor(string? course)
    {
        var words = (course ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length < 2) return ("GEN", Generic("GEN", "General Studies"));

        var degree = words[0].ToUpperInvariant();
        var fieldWords = words.Skip(1).Where(word => char.IsUpper(word[0])).ToArray();
        var field = string.Join(' ', words.Skip(1));
        var initials = string.Concat(fieldWords.Select(word => word[0]));
        var programCode = degree + initials.ToUpperInvariant();

        if (ProgramMajors.TryGetValue(field, out var majors)) return (programCode, majors);
        var subjectPrefix = fieldWords.Length > 1 ? initials.ToUpperInvariant() : field[..Math.Min(3, field.Length)].ToUpperInvariant();
        return (programCode, Generic(subjectPrefix, field));
    }

    private static (string Code, string Name)[] Generic(string prefix, string field) =>
    [
        ($"{prefix} 111", $"Fundamentals of {field}"), ($"{prefix} 121", $"{field} Theory and Practice 1"),
        ($"{prefix} 211", $"{field} Theory and Practice 2"), ($"{prefix} 212", $"Professional Ethics in {field}"),
        ($"{prefix} 221", $"Applied {field}"), ($"{prefix} 311", $"Research Methods in {field}"),
        ($"{prefix} 321", $"Special Topics in {field}"), ($"{prefix} 411", $"{field} Practicum"),
    ];

    private static decimal WeightedPassingGrade(Random random)
    {
        var roll = random.Next(PassingWeights.Sum());
        for (var index = 0; index < PassingGrades.Length; index++)
        {
            roll -= PassingWeights[index];
            if (roll < 0) return PassingGrades[index];
        }
        return PassingGrades[^1];
    }

    /// <summary>FNV-1a hash: unlike string.GetHashCode it is the same on every run, so grades never change.</summary>
    private static int StableSeed(string text)
    {
        var hash = 2166136261u;
        foreach (var value in Encoding.UTF8.GetBytes(text))
        {
            hash = (hash ^ value) * 16777619u;
        }
        return (int)(hash & 0x7FFFFFFF);
    }
}
