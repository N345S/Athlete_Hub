using AthleteHub.API.Data;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

/// <summary>
/// The list of document types offered when uploading. Anyone who uploads can add a missing type; the Sports
/// Director chooses which types are required clearances for eligibility, and can remove unused types.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DocumentTypesController : ControllerBase
{
    // Kept apart from the clearance list: these are created by other features, not chosen when uploading.
    public static readonly HashSet<string> ReservedTypes = new(StringComparer.OrdinalIgnoreCase) { "GRADE_EVALUATION", "Achievement Evidence" };

    private readonly AthleteHubDbContext _context;
    private readonly EligibilityService _eligibility;

    public DocumentTypesController(AthleteHubDbContext context, EligibilityService eligibility)
    {
        _context = context;
        _eligibility = eligibility;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var used = await _context.Documents
            .GroupBy(document => document.DocumentType)
            .Select(group => new { type = group.Key, count = group.Count() })
            .ToDictionaryAsync(item => item.type, item => item.count, StringComparer.OrdinalIgnoreCase);
        var types = await _context.DocumentTypes.AsNoTracking().OrderBy(type => type.Name).ToListAsync();
        // "Other" stays last so it reads as the fallback choice.
        return Ok(types
            .OrderBy(type => string.Equals(type.Name, "Other", StringComparison.OrdinalIgnoreCase))
            .ThenBy(type => type.Name)
            .Select(type => new
            {
                type.DocumentTypeId,
                type.Name,
                type.RequiredForEligibility,
                documents = used.GetValueOrDefault(type.Name)
            }));
    }

    [HttpPost]
    [Authorize(Roles = "ATHLETE,STUDENT,COACH,DIRECTOR")]
    public async Task<IActionResult> Create(DocumentTypeRequest request)
    {
        var name = Clean(request.Name);
        if (name.Length < 2) return BadRequest(new { message = "Please enter a name for the document type." });
        if (name.Length > 100) return BadRequest(new { message = "The document type name must be 100 characters or fewer." });
        if (ReservedTypes.Contains(name)) return BadRequest(new { message = "That name is used by the system. Please choose another." });

        var existing = await _context.DocumentTypes.FirstOrDefaultAsync(type => type.Name == name);
        if (existing != null) return Ok(new { existing.DocumentTypeId, existing.Name, existing.RequiredForEligibility, alreadyExists = true });

        // Only the Director decides what is required; a type added while uploading starts as optional.
        var type = new DocumentType
        {
            Name = name,
            RequiredForEligibility = User.IsInRole("DIRECTOR") && request.RequiredForEligibility,
            CreatedBy = AthleteAccessService.GetUserId(User),
            CreatedAt = DateTime.UtcNow
        };
        _context.DocumentTypes.Add(type);
        await _context.SaveChangesAsync();
        if (type.RequiredForEligibility) await _eligibility.RefreshAsync();
        return Created($"/api/DocumentTypes/{type.DocumentTypeId}", new { type.DocumentTypeId, type.Name, type.RequiredForEligibility, alreadyExists = false });
    }

    /// <summary>Marks a type as a required clearance (or not); every athlete's eligibility is checked again.</summary>
    [HttpPut("{documentTypeId:int}/required")]
    [Authorize(Roles = "DIRECTOR")]
    public async Task<IActionResult> SetRequired(int documentTypeId, DocumentTypeRequiredRequest request)
    {
        var type = await _context.DocumentTypes.FirstOrDefaultAsync(item => item.DocumentTypeId == documentTypeId);
        if (type == null) return NotFound(new { message = "We could not find this document type." });
        if (type.RequiredForEligibility != request.Required)
        {
            type.RequiredForEligibility = request.Required;
            await _context.SaveChangesAsync();
            await _eligibility.RefreshAsync();
        }
        return Ok(new { type.DocumentTypeId, type.Name, type.RequiredForEligibility });
    }

    [HttpDelete("{documentTypeId:int}")]
    [Authorize(Roles = "DIRECTOR")]
    public async Task<IActionResult> Delete(int documentTypeId)
    {
        var type = await _context.DocumentTypes.FirstOrDefaultAsync(item => item.DocumentTypeId == documentTypeId);
        if (type == null) return NotFound(new { message = "We could not find this document type." });
        if (type.RequiredForEligibility) return BadRequest(new { message = "This type is a required clearance. Make it optional before removing it." });
        if (await _context.Documents.AnyAsync(document => document.DocumentType == type.Name))
            return BadRequest(new { message = "Some uploaded documents use this type, so it cannot be removed." });
        _context.DocumentTypes.Remove(type);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Adds the type to the list if an upload used one that is not there yet.</summary>
    public static async Task EnsureExistsAsync(AthleteHubDbContext context, string name, int? userId)
    {
        name = Clean(name);
        if (name.Length == 0 || ReservedTypes.Contains(name) || await context.DocumentTypes.AnyAsync(type => type.Name == name)) return;
        context.DocumentTypes.Add(new DocumentType { Name = name, CreatedBy = userId, CreatedAt = DateTime.UtcNow });
        await context.SaveChangesAsync();
    }

    /// <summary>Trims and collapses spaces so "Medical  clearance " matches "Medical clearance".</summary>
    public static string Clean(string? name) => string.Join(' ', (name ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries));
}

public sealed class DocumentTypeRequest
{
    public string Name { get; set; } = string.Empty;
    public bool RequiredForEligibility { get; set; }
}

public sealed class DocumentTypeRequiredRequest
{
    public bool Required { get; set; }
}
