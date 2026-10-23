using System.ComponentModel.DataAnnotations;

namespace AthleteHub.API.DTOs;

public class UpdateAthleteProfileRequest
{
    [StringLength(150)]
    public string? Course { get; set; }

    [Range(1, 6)]
    public int? YearLevel { get; set; }

    public DateTime? BirthDate { get; set; }

    // Only changed when supplied, so editing other fields never clears an existing photo.
    public string? ProfilePhotoUrl { get; set; }

    [StringLength(30)]
    [RegularExpression(@"^[0-9+()\-\s]*$", ErrorMessage = "The phone number can only have numbers, spaces, and + ( ) -.")]
    public string? Phone { get; set; }
}
