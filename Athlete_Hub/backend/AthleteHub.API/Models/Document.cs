using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class Document
{
    public int DocumentId { get; set; }

    public int AthleteId { get; set; }

    public int? AchievementId { get; set; }

    public string DocumentType { get; set; } = null!;

    public string? Title { get; set; }

    public string? Description { get; set; }

    public string DocumentName { get; set; } = null!;

    public string FileUrl { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateTime? UploadedAt { get; set; }

    public virtual AthleteProfile Athlete { get; set; } = null!;

    public virtual Achievement? Achievement { get; set; }
}
