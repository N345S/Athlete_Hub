using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "ATHLETE,STUDENT")]
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

    [HttpGet("me")]
    public async Task<IActionResult> GetMyDocuments()
    {
        var athlete = await GetCurrentAthleteAsync();

        if (athlete == null)
        {
            return NotFound(new { message = "Athlete profile not found." });
        }

        var documents = await _context.Documents
            .Where(document => document.AthleteId == athlete.AthleteId)
            .OrderByDescending(document => document.UploadedAt)
            .Select(document => new
            {
                document.DocumentId,
                document.DocumentType,
                document.DocumentName,
                document.FileUrl,
                document.Status,
                document.UploadedAt
            })
            .ToListAsync();

        return Ok(documents);
    }

    [HttpPost]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> UploadDocument(
        [FromForm] string documentType,
        [FromForm] IFormFile file)
    {
        if (string.IsNullOrWhiteSpace(documentType))
        {
            return BadRequest(new { message = "Document type is required." });
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "A non-empty file is required." });
        }

        var extension = Path.GetExtension(file.FileName);

        if (!AllowedExtensions.Contains(extension))
        {
            return BadRequest(new
            {
                message = "Unsupported file type.",
                allowedExtensions = AllowedExtensions.OrderBy(value => value)
            });
        }

        var athlete = await GetCurrentAthleteAsync();

        if (athlete == null)
        {
            return NotFound(new { message = "Athlete profile not found." });
        }

        var uploadDirectory = Path.Combine(
            _environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"),
            "uploads",
            "documents");

        Directory.CreateDirectory(uploadDirectory);

        var storedFileName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var storedFilePath = Path.Combine(uploadDirectory, storedFileName);

        await using (var stream = System.IO.File.Create(storedFilePath))
        {
            await file.CopyToAsync(stream);
        }

        var document = new Document
        {
            AthleteId = athlete.AthleteId,
            DocumentType = documentType.Trim(),
            DocumentName = Path.GetFileName(file.FileName),
            FileUrl = $"/uploads/documents/{storedFileName}",
            Status = "PENDING",
            UploadedAt = DateTime.UtcNow
        };

        _context.Documents.Add(document);
        await _context.SaveChangesAsync();

        return Created($"/api/Documents/{document.DocumentId}", new
        {
            document.DocumentId,
            document.DocumentType,
            document.DocumentName,
            document.FileUrl,
            document.Status,
            document.UploadedAt
        });
    }

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
}