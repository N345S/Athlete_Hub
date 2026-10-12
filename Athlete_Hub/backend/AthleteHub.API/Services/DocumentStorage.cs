using AthleteHub.API.Models;

namespace AthleteHub.API.Services;

/// <summary>
/// Stores athlete documents outside the public web root so they are only reachable
/// through authorized API endpoints.
/// </summary>
public class DocumentStorage
{
    private const string StoragePrefix = "documents/";
    private const string LegacyPublicPrefix = "/uploads/documents/";

    private readonly IWebHostEnvironment _environment;

    public DocumentStorage(IWebHostEnvironment environment) => _environment = environment;

    private string PrivateDirectory => Path.Combine(_environment.ContentRootPath, "private-uploads", "documents");

    // Files uploaded before documents were made private still live under wwwroot.
    private string LegacyDirectory => Path.Combine(_environment.ContentRootPath, "wwwroot", "uploads", "documents");

    /// <summary>
    /// Saves the upload under a random name and returns the value to store in Document.FileUrl.
    /// </summary>
    public async Task<string> SaveAsync(IFormFile file)
    {
        Directory.CreateDirectory(PrivateDirectory);
        var storedFileName = $"{Guid.NewGuid():N}{Path.GetExtension(file.FileName).ToLowerInvariant()}";
        await using var stream = File.Create(Path.Combine(PrivateDirectory, storedFileName));
        await file.CopyToAsync(stream);
        return StoragePrefix + storedFileName;
    }

    /// <summary>
    /// Writes each file to private storage and builds (unsaved) Document rows for them. Clearance
    /// documents are filed as soon as they are uploaded (no approval step); achievement evidence stays
    /// PENDING because it is reviewed with the athlete's portfolio item.
    /// </summary>
    public async Task<List<Document>> CreateDocumentsAsync(
        IEnumerable<IFormFile> files, int athleteId, string documentType, string? title, string? description, int? achievementId)
    {
        var documents = new List<Document>();
        foreach (var file in files)
        {
            documents.Add(new Document
            {
                AthleteId = athleteId,
                AchievementId = achievementId,
                DocumentType = documentType,
                Title = string.IsNullOrWhiteSpace(title) ? null : title.Trim(),
                Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
                DocumentName = Path.GetFileName(file.FileName),
                FileUrl = await SaveAsync(file),
                Status = achievementId.HasValue ? "PENDING" : "APPROVED",
                UploadedAt = DateTime.UtcNow
            });
        }

        return documents;
    }

    /// <summary>
    /// The authorized download URL clients use for a document.
    /// </summary>
    public static string DownloadUrl(int documentId) => $"/api/Documents/{documentId}/file";

    /// <summary>
    /// Resolves a stored FileUrl to a physical path, or null when it is missing or not a document path.
    /// Only the file name is used, so a tampered value cannot escape the storage folders.
    /// </summary>
    public string? ResolvePath(string fileUrl)
    {
        var normalized = fileUrl.Replace('\\', '/');
        if (!normalized.StartsWith(StoragePrefix, StringComparison.Ordinal)
            && !normalized.StartsWith(LegacyPublicPrefix, StringComparison.Ordinal))
        {
            return null;
        }

        var fileName = Path.GetFileName(normalized);
        if (string.IsNullOrEmpty(fileName)) return null;

        foreach (var directory in new[] { PrivateDirectory, LegacyDirectory })
        {
            var candidate = Path.Combine(directory, fileName);
            if (File.Exists(candidate)) return candidate;
        }

        return null;
    }

    public void Delete(string fileUrl)
    {
        var path = ResolvePath(fileUrl);
        if (path != null) File.Delete(path);
    }

    /// <summary>
    /// Moves files left in the old public folder into private storage. Their FileUrl keeps working
    /// because <see cref="ResolvePath"/> matches on file name.
    /// </summary>
    public void MoveLegacyFilesToPrivateStorage()
    {
        if (!Directory.Exists(LegacyDirectory)) return;
        Directory.CreateDirectory(PrivateDirectory);
        foreach (var source in Directory.EnumerateFiles(LegacyDirectory))
        {
            var destination = Path.Combine(PrivateDirectory, Path.GetFileName(source));
            if (!File.Exists(destination)) File.Move(source, destination);
        }
    }

    public static string GetContentType(string fileName) => Path.GetExtension(fileName).ToLowerInvariant() switch
    {
        ".pdf" => "application/pdf",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".doc" => "application/msword",
        ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        _ => "application/octet-stream"
    };
}
