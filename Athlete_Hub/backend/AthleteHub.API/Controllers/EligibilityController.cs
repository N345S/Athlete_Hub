using System.Security.Claims;
using System.Text;
using System.Text.Json;
using AthleteHub.API.Data;
using AthleteHub.API.DTOs;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EligibilityController : ControllerBase
{
    private static readonly string[] ValidStatuses = ["ELIGIBLE", "AT_RISK", "INELIGIBLE", "PENDING"];
    private static readonly HashSet<string> ValidReasons = new(StringComparer.Ordinal)
    {
        "Failing Grades",
        "Academic Requirement Not Met",
        "Incomplete Academic Requirement",
        "Other"
    };
    private readonly AthleteHubDbContext _context;
    private readonly IWebHostEnvironment _environment;
    private readonly AthleteAccessService _access;
    private readonly NotificationService _notifications;

    public EligibilityController(AthleteHubDbContext context, IWebHostEnvironment environment, AthleteAccessService access, NotificationService notifications)
    {
        _context = context;
        _environment = environment;
        _access = access;
        _notifications = notifications;
    }

    [HttpGet("athlete/{athleteId}")]
    public async Task<IActionResult> GetAthleteEligibility(int athleteId)
    {
        if (!await CanViewAthleteAsync(athleteId)) return Forbid();
        var records = await _context.EligibilityRecords
            .Include(record => record.Term)
            .Include(record => record.Athlete).ThenInclude(athlete => athlete.User)
            .Where(record => record.AthleteId == athleteId)
            .OrderByDescending(record => record.RequestedAt ?? record.ReviewedAt ?? record.EvaluatedAt)
            .ToListAsync();
        var evaluations = await MapEvaluationsAsync(records);
        return Ok(new { athleteId, recordCount = evaluations.Count, records = evaluations });
    }

    [HttpGet("registrar")]
    [Authorize(Roles = "REGISTRAR")]
    public async Task<IActionResult> GetRegistrarEvaluations()
    {
        var records = await _context.EligibilityRecords
            .Include(record => record.Term)
            .Include(record => record.Athlete).ThenInclude(athlete => athlete.User)
            .OrderByDescending(record => record.RequestedAt ?? record.ReviewedAt ?? record.EvaluatedAt)
            .ToListAsync();
        return Ok(new { evaluations = await MapEvaluationsAsync(records) });
    }

    // The Director of Sports requests Grade Evaluations; coaches only see the resulting decisions.
    [HttpPost("request")]
    [Authorize(Roles = "DIRECTOR")]
    public async Task<IActionResult> RequestGradeEvaluation(GradeEvaluationRequest request)
    {
        if (!await CanViewAthleteAsync(request.AthleteId)) return Forbid();
        if (string.IsNullOrWhiteSpace(request.AcademicYear) || string.IsNullOrWhiteSpace(request.Semester))
            return BadRequest(new { message = "Academic year and semester are required." });
        if (request.AcademicYear.Trim().Length > 20 || request.Semester.Trim().Length > 50)
            return BadRequest(new { message = "Academic year and semester are too long." });

        var academicYear = request.AcademicYear.Trim();
        var semester = request.Semester.Trim();
        var term = await _context.AcademicTerms.FirstOrDefaultAsync(item =>
            item.AcademicYear == academicYear && item.Semester == semester);
        if (term == null)
        {
            term = new AcademicTerm { AcademicYear = academicYear, Semester = semester };
            _context.AcademicTerms.Add(term);
            await _context.SaveChangesAsync();
        }

        var record = await _context.EligibilityRecords
            .Include(item => item.Term)
            .Include(item => item.Athlete).ThenInclude(athlete => athlete.User)
            .FirstOrDefaultAsync(item => item.AthleteId == request.AthleteId && item.TermId == term.TermId);
        var alreadyExists = record != null;
        if (record == null)
        {
            var athlete = await _context.AthleteProfiles
                .Include(profile => profile.User)
                .FirstAsync(profile => profile.AthleteId == request.AthleteId);
            record = new EligibilityRecord
            {
                AthleteId = request.AthleteId,
                TermId = term.TermId,
                Athlete = athlete,
                Term = term,
                AcademicStatus = "PENDING",
                RequestedBy = GetCurrentUserId(),
                RequestedAt = DateTime.UtcNow
            };
            _context.EligibilityRecords.Add(record);
            await _context.SaveChangesAsync();

            _notifications.Notify(
                await _notifications.ActiveUserIdsInRoleAsync("REGISTRAR"),
                "Grade evaluation requested",
                $"A grade evaluation was requested for {record.Athlete.User.FirstName} {record.Athlete.User.LastName} ({term.AcademicYear}, {term.Semester}).",
                "GRADE_EVALUATION_REQUEST");
            _notifications.Notify(
                await _notifications.CoachUserIdsForAthleteAsync(record.AthleteId),
                "Grade evaluation requested",
                $"The Director of Sports requested a grade evaluation for {record.Athlete.User.FirstName} {record.Athlete.User.LastName} ({term.AcademicYear}, {term.Semester}). You will be notified of the Registrar's decision.",
                "GRADE_EVALUATION_REQUEST");
            await _context.SaveChangesAsync();
        }

        var evaluations = await MapEvaluationsAsync([record]);
        return Ok(new
        {
            alreadyExists,
            message = alreadyExists ? "An evaluation or request already exists for this term." : "Grade evaluation request sent to the Registrar.",
            evaluation = evaluations[0]
        });
    }

    [HttpPost("{eligibilityId:int}/document")]
    [Authorize(Roles = "REGISTRAR")]
    [RequestSizeLimit(10_500_000)]
    public async Task<IActionResult> UploadGradeEvaluation(int eligibilityId, [FromForm] IFormFile? file)
    {
        if (file == null || file.Length == 0) return BadRequest(new { message = "Select a Grade Evaluation PDF to upload." });
        if (file.Length > 10_000_000) return BadRequest(new { message = "The PDF must be 10 MB or smaller." });
        if (!string.Equals(Path.GetExtension(file.FileName), ".pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only PDF files are accepted." });

        await using (var input = file.OpenReadStream())
        {
            var signature = new byte[5];
            var bytesRead = await input.ReadAsync(signature);
            if (bytesRead != signature.Length || Encoding.ASCII.GetString(signature) != "%PDF-")
                return BadRequest(new { message = "The selected file is not a valid PDF." });
        }

        var record = await _context.EligibilityRecords
            .Include(item => item.Term)
            .Include(item => item.Athlete).ThenInclude(athlete => athlete.User)
            .FirstOrDefaultAsync(item => item.EligibilityId == eligibilityId);
        if (record == null) return NotFound(new { message = "Grade evaluation request not found." });
        if (record.DocumentId.HasValue) return Conflict(new { message = "A Grade Evaluation PDF is already attached to this request." });

        var uploadDirectory = Path.Combine(_environment.ContentRootPath, "private-uploads", "grade-evaluations");
        Directory.CreateDirectory(uploadDirectory);
        var storedFileName = $"{Guid.NewGuid():N}.pdf";
        var storedFilePath = Path.Combine(uploadDirectory, storedFileName);
        await using (var output = System.IO.File.Create(storedFilePath))
        await using (var input = file.OpenReadStream())
        {
            await input.CopyToAsync(output);
        }

        var document = new Document
        {
            AthleteId = record.AthleteId,
            DocumentType = "GRADE_EVALUATION",
            Title = "Official Grade Evaluation",
            Description = $"{record.Term.AcademicYear} · {record.Term.Semester}",
            DocumentName = Path.GetFileName(file.FileName),
            FileUrl = $"grade-evaluations/{storedFileName}",
            Status = "APPROVED",
            UploadedAt = DateTime.UtcNow
        };
        _context.Documents.Add(document);
        await _context.SaveChangesAsync();

        record.DocumentId = document.DocumentId;
        record.UploadedBy = GetCurrentUserId();
        if (record.RequestedBy.HasValue)
        {
            _notifications.Notify(record.RequestedBy.Value, "Grade Evaluation received",
                $"The Registrar uploaded the Grade Evaluation for {record.Athlete.User.FirstName} {record.Athlete.User.LastName} ({record.Term.AcademicYear}, {record.Term.Semester}); a decision will follow.",
                "GRADE_EVALUATION_UPLOADED");
        }
        await _context.SaveChangesAsync();

        return Ok(new
        {
            documentId = document.DocumentId,
            documentName = document.DocumentName,
            uploadedAt = document.UploadedAt,
            fileUrl = $"/api/Eligibility/documents/{document.DocumentId}/file"
        });
    }

    [HttpGet("documents/{documentId:int}/file")]
    [Authorize(Roles = "REGISTRAR,COACH,DIRECTOR")]
    public async Task<IActionResult> OpenGradeEvaluation(int documentId)
    {
        var record = await _context.EligibilityRecords
            .FirstOrDefaultAsync(item => item.DocumentId == documentId);
        if (record == null) return NotFound(new { message = "Grade Evaluation PDF not found." });

        if (!User.IsInRole("REGISTRAR"))
        {
            if (record.AcademicStatus is not ("ELIGIBLE" or "INELIGIBLE") || record.ReviewedAt == null)
                return Forbid();
            if (!await CanViewAthleteAsync(record.AthleteId)) return Forbid();
        }

        var document = await _context.Documents.FirstOrDefaultAsync(item => item.DocumentId == documentId);
        if (document == null) return NotFound(new { message = "Grade Evaluation PDF not found." });
        var relativePath = document.FileUrl.Replace('\\', '/');
        var storedFileName = Path.GetFileName(relativePath);
        if (!relativePath.StartsWith("grade-evaluations/", StringComparison.Ordinal)
            || !string.Equals(Path.GetExtension(storedFileName), ".pdf", StringComparison.OrdinalIgnoreCase))
            return NotFound(new { message = "Grade Evaluation PDF not found." });

        var filePath = Path.Combine(_environment.ContentRootPath, "private-uploads", "grade-evaluations", storedFileName);
        if (!System.IO.File.Exists(filePath)) return NotFound(new { message = "The PDF file is unavailable." });
        Response.Headers.ContentDisposition = new System.Net.Mime.ContentDisposition
        {
            Inline = true,
            FileName = document.DocumentName
        }.ToString();
        return PhysicalFile(filePath, "application/pdf", enableRangeProcessing: true);
    }

    [HttpPost("review")]
    [Authorize(Roles = "REGISTRAR")]
    public async Task<IActionResult> Review(EligibilityReviewRequest request)
    {
        var status = request.AcademicStatus.Trim().ToUpperInvariant();
        if (status is not ("ELIGIBLE" or "INELIGIBLE"))
            return BadRequest(new { message = "Status must be ELIGIBLE or INELIGIBLE." });
        if (string.IsNullOrWhiteSpace(request.AcademicYear) || string.IsNullOrWhiteSpace(request.Semester))
            return BadRequest(new { message = "Academic year and semester are required." });
        if (request.AcademicYear.Trim().Length > 20 || request.Semester.Trim().Length > 50)
            return BadRequest(new { message = "Academic year and semester are too long." });
        var selectedReasons = (request.Reasons ?? [])
            .Select(reason => reason.Trim())
            .Where(reason => reason.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (selectedReasons.Any(reason => !ValidReasons.Contains(reason)))
            return BadRequest(new { message = "One or more eligibility reasons are not recognized." });
        if (status == "INELIGIBLE" && selectedReasons.Count == 0)
            return BadRequest(new { message = "Select at least one reason for an ineligible decision." });

        var year = request.AcademicYear.Trim();
        var semester = request.Semester.Trim();
        var term = await _context.AcademicTerms.FirstOrDefaultAsync(item => item.AcademicYear == year && item.Semester == semester);
        if (term == null) return NotFound(new { message = "Academic term not found." });

        var record = await _context.EligibilityRecords
            .Include(item => item.Athlete).ThenInclude(athlete => athlete.User)
            .FirstOrDefaultAsync(item => item.AthleteId == request.AthleteId && item.TermId == term.TermId);
        if (record == null) return NotFound(new { message = "Grade evaluation request not found." });
        if (!record.DocumentId.HasValue) return BadRequest(new { message = "Upload the official Grade Evaluation PDF before submitting the review." });

        record.AcademicStatus = status;
        record.EligibilityReasons = JsonSerializer.Serialize(selectedReasons);
        record.Remarks = string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim();
        record.ReviewedBy = GetCurrentUserId();
        record.ReviewedAt = DateTime.UtcNow;
        record.EvaluatedAt = record.ReviewedAt;

        // The athlete's coaches need the decision to plan their roster; the requesting director is told too.
        var recipients = await _notifications.CoachUserIdsForAthleteAsync(record.AthleteId);
        if (record.RequestedBy.HasValue) recipients.Add(record.RequestedBy.Value);
        var athleteName = $"{record.Athlete.User.FirstName} {record.Athlete.User.LastName}";
        _notifications.Notify(recipients,
            status == "ELIGIBLE" ? "Athlete eligible" : "Athlete ineligible",
            $"The Registrar marked {athleteName} {status.ToLowerInvariant()} for {term.AcademicYear}, {term.Semester}.{(selectedReasons.Count > 0 ? $" Reasons: {string.Join(", ", selectedReasons)}." : string.Empty)}",
            "ELIGIBILITY_DECISION");
        await _context.SaveChangesAsync();
        return Ok(new
        {
            record.EligibilityId,
            record.AthleteId,
            record.AcademicStatus,
            reasons = selectedReasons,
            record.Remarks,
            record.ReviewedAt,
            term = new { term.AcademicYear, term.Semester }
        });
    }

    private async Task<List<object>> MapEvaluationsAsync(List<EligibilityRecord> records)
    {
        var documentIds = records.Where(record => record.DocumentId.HasValue)
            .Select(record => record.DocumentId!.Value)
            .Distinct()
            .ToList();
        var documents = await _context.Documents
            .Where(document => documentIds.Contains(document.DocumentId))
            .ToDictionaryAsync(document => document.DocumentId);
        var requesterIds = records.Where(record => record.RequestedBy.HasValue).Select(record => record.RequestedBy!.Value).Distinct().ToList();
        var requesterNames = await _context.Users
            .Where(user => requesterIds.Contains(user.UserId))
            .ToDictionaryAsync(user => user.UserId, user => user.FirstName + " " + user.LastName);

        return records.Select(record =>
        {
            documents.TryGetValue(record.DocumentId ?? 0, out var document);
            return (object)new
            {
                eligibilityId = record.EligibilityId,
                athleteId = record.AthleteId,
                academicStatus = record.AcademicStatus,
                reasons = DeserializeReasons(record.EligibilityReasons),
                remarks = record.Remarks,
                requestedAt = record.RequestedAt,
                reviewedAt = record.ReviewedAt,
                requestedBy = record.RequestedBy,
                requestedByName = record.RequestedBy.HasValue ? requesterNames.GetValueOrDefault(record.RequestedBy.Value) : null,
                uploadedBy = record.UploadedBy,
                reviewedBy = record.ReviewedBy,
                student = new
                {
                    athleteId = record.Athlete.AthleteId,
                    studentNumber = record.Athlete.StudentNumber,
                    firstName = record.Athlete.User.FirstName,
                    lastName = record.Athlete.User.LastName,
                    course = record.Athlete.Course,
                    yearLevel = record.Athlete.YearLevel
                },
                term = new { academicYear = record.Term.AcademicYear, semester = record.Term.Semester },
                document = document == null ? null : new
                {
                    documentId = document.DocumentId,
                    documentName = document.DocumentName,
                    uploadedAt = document.UploadedAt,
                    fileUrl = $"/api/Eligibility/documents/{document.DocumentId}/file"
                }
            };
        }).ToList();
    }

    private static string[] DeserializeReasons(string? reasons)
    {
        if (string.IsNullOrWhiteSpace(reasons)) return [];
        try
        {
            return JsonSerializer.Deserialize<string[]>(reasons) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private int? GetCurrentUserId() =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null;

    private Task<bool> CanViewAthleteAsync(int athleteId) => _access.CanViewAthleteAsync(User, athleteId, includeRegistrar: true);
}

public sealed class EligibilityReviewRequest
{
    public int AthleteId { get; set; }
    public string AcademicYear { get; set; } = string.Empty;
    public string Semester { get; set; } = string.Empty;
    public string AcademicStatus { get; set; } = string.Empty;
    public List<string> Reasons { get; set; } = [];
    public string? Remarks { get; set; }
}

public sealed class GradeEvaluationRequest
{
    public int AthleteId { get; set; }
    public string AcademicYear { get; set; } = string.Empty;
    public string Semester { get; set; } = string.Empty;
}
