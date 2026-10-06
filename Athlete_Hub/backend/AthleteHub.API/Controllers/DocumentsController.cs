using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

/// <summary>
/// Controller for managing athlete documents and file uploads.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DocumentsController : ControllerBase
{
    public static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx"
    };

    public const long MaxFileSize = 10_000_000;

    private readonly AthleteHubDbContext _context;
    private readonly DocumentStorage _storage;
    private readonly AthleteAccessService _access;

    public DocumentsController(
        AthleteHubDbContext context,
        DocumentStorage storage,
        AthleteAccessService access)
    {
        _context = context;
        _storage = storage;
        _access = access;
    }

    /// <summary>
    /// Gets all documents for the currently authenticated athlete.
    /// </summary>
    /// <returns>List of documents ordered by upload date (newest first).</returns>
    /// <response code="200">Returns the list of documents.</response>
    /// <response code="401">Invalid or missing JWT token.</response>
    /// <response code="404">Athlete profile not found.</response>
    [HttpGet("me")]
    public async Task<IActionResult> GetMyDocuments()
    {
        var athlete = await GetCurrentAthleteAsync();

        if (athlete == null)
        {
            return NotFound(new { message = "Athlete profile not found." });
        }

        var documents = await _context.Documents
            .Where(document => document.AthleteId == athlete.AthleteId && document.DocumentType != "GRADE_EVALUATION")
            .OrderByDescending(document => document.UploadedAt)
            .ToListAsync();

        return Ok(documents.Select(ToResponse));
    }

    /// <summary>
    /// Gets all documents for a specific athlete (their coach or the director).
    /// </summary>
    /// <param name="athleteId">The athlete ID to retrieve documents for.</param>
    /// <returns>List of documents for the specified athlete.</returns>
    /// <response code="200">Returns the list of documents.</response>
    /// <response code="401">Invalid or missing JWT token.</response>
    /// <response code="403">User not authorized to view this athlete's documents.</response>
    [HttpGet("athlete/{athleteId:int}")]
    [Authorize(Roles = "COACH,DIRECTOR")]
    public async Task<IActionResult> GetAthleteDocuments(int athleteId)
    {
        if (!await _access.CanViewAthleteAsync(User, athleteId, includeRegistrar: false))
        {
            return Forbid();
        }

        var documents = await _context.Documents
            .Where(document => document.AthleteId == athleteId && document.DocumentType != "GRADE_EVALUATION")
            .OrderByDescending(document => document.UploadedAt)
            .ToListAsync();

        return Ok(documents.Select(ToResponse));
    }

    /// <summary>
    /// Streams a document's file to the owning athlete or staff allowed to view that athlete.
    /// </summary>
    /// <response code="200">The file content.</response>
    /// <response code="403">User not authorized to view this document.</response>
    /// <response code="404">Document or file not found.</response>
    [HttpGet("{documentId:int}/file")]
    public async Task<IActionResult> GetDocumentFile(int documentId)
    {
        var document = await _context.Documents.FirstOrDefaultAsync(item => item.DocumentId == documentId);

        // Grade evaluations have their own endpoint with registrar review rules.
        if (document == null || document.DocumentType == "GRADE_EVALUATION")
        {
            return NotFound(new { message = "Document not found." });
        }

        if (!await _access.CanViewAthleteAsync(User, document.AthleteId, includeRegistrar: false))
        {
            return Forbid();
        }

        var path = _storage.ResolvePath(document.FileUrl);
        if (path == null)
        {
            return NotFound(new { message = "The file is unavailable." });
        }

        Response.Headers.ContentDisposition = new System.Net.Mime.ContentDisposition
        {
            Inline = true,
            FileName = document.DocumentName
        }.ToString();
        return PhysicalFile(path, DocumentStorage.GetContentType(document.DocumentName), enableRangeProcessing: true);
    }

    /// <summary>
    /// Uploads one or more documents for the current athlete.
    /// </summary>
    /// <param name="documentType">The type of document (e.g., "Medical Clearance", "Consent Form").</param>
    /// <param name="title">Optional title for the document.</param>
    /// <param name="description">Optional description of the document.</param>
    /// <param name="achievementId">Optional achievement ID to link as evidence.</param>
    /// <returns>Created document records.</returns>
    /// <response code="201">Documents uploaded successfully.</response>
    /// <response code="400">Invalid document type, missing files, unsupported file type, or file too large.</response>
    /// <response code="401">Invalid or missing JWT token.</response>
    /// <response code="404">Athlete profile not found.</response>
    [HttpPost]
    [Authorize(Roles = "ATHLETE,STUDENT")]
    [RequestSizeLimit(60_000_000)]
    public async Task<IActionResult> UploadDocument(
        [FromForm] string documentType,
        [FromForm] string? title,
        [FromForm] string? description,
        [FromForm] int? achievementId)
    {
        if (string.IsNullOrWhiteSpace(documentType))
        {
            return BadRequest(new { message = "Document type is required." });
        }
        if (string.Equals(documentType.Trim(), "GRADE_EVALUATION", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Grade Evaluation PDFs must be uploaded by the Registrar." });
        }

        var files = GetUploadedFiles(Request.Form.Files);
        var validationError = ValidateFiles(files);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        var athlete = await GetCurrentAthleteAsync();

        if (athlete == null)
        {
            return NotFound(new { message = "Athlete profile not found." });
        }

        if (achievementId.HasValue && !await _context.Achievements.AnyAsync(achievement =>
                achievement.AchievementId == achievementId.Value && achievement.AthleteId == athlete.AthleteId))
        {
            return BadRequest(new { message = "The evidence achievement does not belong to this athlete." });
        }

        var documents = await _storage.CreateDocumentsAsync(files, athlete.AthleteId, documentType.Trim(), title, description, achievementId);
        _context.Documents.AddRange(documents);
        await _context.SaveChangesAsync();

        return Created($"/api/Documents/{documents[0].DocumentId}", documents.Select(ToResponse));
    }

    /// <summary>
    /// Deletes a document owned by the current athlete.
    /// </summary>
    /// <param name="documentId">The ID of the document to delete.</param>
    /// <returns>No content on success.</returns>
    /// <response code="204">Document deleted successfully.</response>
    /// <response code="401">Invalid or missing JWT token.</response>
    /// <response code="404">Document not found or not owned by the current athlete.</response>
    [HttpDelete("{documentId:int}")]
    [Authorize(Roles = "ATHLETE,STUDENT")]
    public async Task<IActionResult> DeleteDocument(int documentId)
    {
        var athlete = await GetCurrentAthleteAsync();
        var document = athlete == null
            ? null
            : await _context.Documents.FirstOrDefaultAsync(item =>
                item.DocumentId == documentId && item.AthleteId == athlete.AthleteId);

        if (document == null)
        {
            return NotFound(new { message = "Document not found." });
        }
        if (string.Equals(document.DocumentType, "GRADE_EVALUATION", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Grade Evaluation PDFs cannot be deleted from the athlete document portal." });
        }

        _context.Documents.Remove(document);
        await _context.SaveChangesAsync();
        _storage.Delete(document.FileUrl);

        return NoContent();
    }

    /// <summary>
    /// The files posted under the "file" or "files" form fields.
    /// </summary>
    public static List<IFormFile> GetUploadedFiles(IFormFileCollection formFiles) => formFiles
        .Where(file => string.Equals(file.Name, "file", StringComparison.OrdinalIgnoreCase)
            || string.Equals(file.Name, "files", StringComparison.OrdinalIgnoreCase))
        .ToList();

    /// <summary>
    /// Returns an error message when the upload set is empty, has an empty or oversized file, or an unsupported type.
    /// </summary>
    public static string? ValidateFiles(IReadOnlyCollection<IFormFile> files)
    {
        if (files.Count == 0) return "At least one non-empty file is required.";
        if (files.Any(file => file.Length == 0)) return "Files must not be empty.";

        var invalidFile = files.FirstOrDefault(file => !AllowedExtensions.Contains(Path.GetExtension(file.FileName)));
        if (invalidFile != null)
        {
            return $"Unsupported file type: {Path.GetFileName(invalidFile.FileName)}. Allowed: {string.Join(", ", AllowedExtensions.Order())}.";
        }

        var oversizedFile = files.FirstOrDefault(file => file.Length > MaxFileSize);
        return oversizedFile == null ? null : $"File exceeds the 10 MB limit: {Path.GetFileName(oversizedFile.FileName)}.";
    }

    public static object ToResponse(Document document) => new
    {
        document.DocumentId,
        document.DocumentType,
        document.Title,
        document.Description,
        document.DocumentName,
        FileUrl = DocumentStorage.DownloadUrl(document.DocumentId),
        document.Status,
        document.AchievementId,
        document.UploadedAt
    };

    private async Task<AthleteProfile?> GetCurrentAthleteAsync()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return null;
        }

        return await _context.AthleteProfiles.FirstOrDefaultAsync(a => a.UserId == userId);
    }
}
