namespace AthleteHub.API.DTOs;

public class UpdateAthleteProfileRequest
{
    public string? Course { get; set; }

    public int? YearLevel { get; set; }

    public DateTime? BirthDate { get; set; }

    public string? ProfilePhotoUrl { get; set; }

    public string? Phone { get; set; }
}