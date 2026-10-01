using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.Models;
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
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx"
    };

    private readonly AthleteHubDbContext _context;
    private readonly IWebHostEnvironment _environment;

    public DocumentsController(
        AthleteHubDbContext context,
        IWebHostEnvironment environment)
    {
        _context = context;
        _environment = environment;
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
            .Select(document => new
            {
                document.DocumentId,
                document.DocumentType,
                document.Title,
                document.Description,
                document.DocumentName,
                document.FileUrl,
                document.Status,
                document.AchievementId,
                document.UploadedAt
            })
            .ToListAsync();

        return Ok(documents);
    }

    /// <summary>
    /// Gets all documents for a specific athlete (coach/director/admin only).
    /// </summary>
    /// <param name="athleteId">The athlete ID to retrieve documents for.</param>
    /// <returns>List of documents for the specified athlete.</returns>
    /// <response code="200">Returns the list of documents.</response>
    /// <response code="401">Invalid or missing JWT token.</response>
    /// <response code="403">User not authorized to view this athlete's documents.</response>
    [HttpGet("athlete/{athleteId:int}")]
    [Authorize(Roles = "COACH,DIRECTOR,ADMIN")]
    public async Task<IActionResult> GetAthleteDocuments(int athleteId)
    {
        if (!await CanViewAthleteAsync(athleteId))
        {
            return Forbid();
        }

        var documents = await _context.Documents
            .Where(document => document.AthleteId == athleteId)
            .OrderByDescending(document => document.UploadedAt)
            .Select(document => new
            {
                document.DocumentId,
                document.DocumentType,
                document.Title,
                document.Description,
                document.DocumentName,
                document.FileUrl,
                document.Status,
                document.AchievementId,
                document.UploadedAt
            })
            .ToListAsync();

        return Ok(documents);
    }

    /// <summary>
    /// Uploads one or more documents for the current athlete.
    /// </summary>
    /// <param name="documentType">The type of document (e.g., "Medical Clearance", "Consent Form").</param>
    /// <param name="title">Optional title for the document.</param>
    /// <param name="description">Optional description of the document.</param>
    /// <param name="achievementId">Optional achievement ID to link as evidence.</param>
    /// <returns>Created document records with file URLs.</returns>
    /// <response code="201">Documents uploaded successfully.</response>
    /// <response code="400">Invalid document type, missing files, unsupported file type, or file too large.</response>
    /// <response code="401">Invalid or missing JWT token.</response>
    /// <response code="404">Athlete profile not found.</response>
    /// <response code="413">File exceeds 10 MB limit.</response>
    [HttpPost]
    [Authorize(Roles = "ATHLETE,STUDENT")]
    [RequestSizeLimit(100_000_000)]
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

        var files = Request.Form.Files
            .Where(file => string.Equals(file.Name, "file", StringComparison.OrdinalIgnoreCase)
                || string.Equals(file.Name, "files", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (files.Count == 0)
        {
            return BadRequest(new { message = "At least one non-empty file is required." });
        }

        if (files.Any(file => file.Length == 0))
        {
            return BadRequest(new { message = "Files must not be empty." });
        }

        var invalidFile = files.Select(file => new { file, extension = Path.GetExtension(file.FileName) })
            .FirstOrDefault(item => !AllowedExtensions.Contains(item.extension));
        if (invalidFile != null)
        {
            return BadRequest(new
            {
                message = $"Unsupported file type: {Path.GetFileName(invalidFile.file.FileName)}.",
                allowedExtensions = AllowedExtensions.OrderBy(value => value)
            });
        }

        var oversizedFile = files.FirstOrDefault(file => file.Length > 10_000_000);
        if (oversizedFile != null)
        {
            return BadRequest(new { message = $"File exceeds the 10 MB limit: {Path.GetFileName(oversizedFile.FileName)}." });
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

        var uploadDirectory = Path.Combine(
            _environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"),
            "uploads",
            "documents");

        Directory.CreateDirectory(uploadDirectory);

        var documents = new List<Document>();
        foreach (var file in files)
        {
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            var storedFileName = $"{Guid.NewGuid():N}{extension}";
            var storedFilePath = Path.Combine(uploadDirectory, storedFileName);

            await using (var stream = System.IO.File.Create(storedFilePath))
            {
                await file.CopyToAsync(stream);
            }

            documents.Add(new Document
            {
                AthleteId = athlete.AthleteId,
                AchievementId = achievementId,
                DocumentType = documentType.Trim(),
                Title = string.IsNullOrWhiteSpace(title) ? null : title.Trim(),
                Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
                DocumentName = Path.GetFileName(file.FileName),
                FileUrl = $"/uploads/documents/{storedFileName}",
                Status = "PENDING",
                UploadedAt = DateTime.UtcNow
            });
        }

        _context.Documents.AddRange(documents);
        await _context.SaveChangesAsync();

        return Created($"/api/Documents/{documents[0].DocumentId}", documents.Select(document => new
        {
            document.DocumentId,
            document.DocumentType,
            document.Title,
            document.Description,
            document.DocumentName,
            document.FileUrl,
            document.Status,
            document.AchievementId,
            document.UploadedAt
        }));
    }

    /// <summary>
    /// Deletes a document owned by the current athlete.
    /// </summary>
    /// <param name="documentId">The ID of the document to delete.</param>
    /// <returns>No content on success.</returns>
    /// <response code="204">Document deleted successfully.</response>
    /// <response code="401">Invalid or missing JWT token.</response>
    /// <response code="404">Document not found or not owned by the current athlete.</response>
    [HttpDelete("{documentId}")]
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

        var relativePath = document.FileUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var filePath = Path.Combine(_environment.ContentRootPath, "wwwroot", relativePath);

        if (System.IO.File.Exists(filePath))
        {
            System.IO.File.Delete(filePath);
        }

        _context.Documents.Remove(document);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private async Task<AthleteProfile?> GetCurrentAthleteAsync()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return null;
        }

        return await _context.AthleteProfiles.FirstOrDefaultAsync(a => a.UserId == userId);
    }

    private async Task<bool> CanViewAthleteAsync(int athleteId)
    {
        if (User.IsInRole("DIRECTOR") || User.IsInRole("ADMIN"))
        {
            return await _context.AthleteProfiles.AnyAsync(athlete => athlete.AthleteId == athleteId);
        }

        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return false;
        }

        var coach = await _context.CoachProfiles.FirstOrDefaultAsync(item => item.UserId == userId);
        return coach != null && await _context.TeamMembers.AnyAsync(member =>
            member.AthleteId == athleteId && member.DateLeft == null && member.Team.CoachId == coach.CoachId);
    }
}