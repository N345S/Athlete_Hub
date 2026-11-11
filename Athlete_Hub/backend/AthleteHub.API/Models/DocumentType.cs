namespace AthleteHub.API.Models;

/// <summary>
/// A kind of document athletes upload (Medical Clearance, Consent Form, ...). Anyone uploading can add a new type;
/// the Sports Director decides which types every athlete must have on file to stay eligible.
/// </summary>
public class DocumentType
{
    public int DocumentTypeId { get; set; }

    public string Name { get; set; } = null!;

    public bool RequiredForEligibility { get; set; }

    public int? CreatedBy { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual User? CreatedByNavigation { get; set; }
}
