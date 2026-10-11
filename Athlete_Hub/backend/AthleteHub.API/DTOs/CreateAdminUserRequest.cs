using System.ComponentModel.DataAnnotations;

namespace AthleteHub.API.DTOs;

public class CreateAdminUserRequest
{
    [Required]
    public int RoleId { get; set; }

    /// <summary>Required for every role except PARENT, which has no university ID.</summary>
    public string? UniversityId { get; set; }

    /// <summary>For PARENT accounts: the university IDs of the athletes this parent monitors.</summary>
    public List<string>? ChildUniversityIds { get; set; }

    [MaxLength(50)]
    public string? Relationship { get; set; }

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string FirstName { get; set; } = string.Empty;

    public string? MiddleName { get; set; }

    [Required]
    public string LastName { get; set; } = string.Empty;

    public string? Phone { get; set; }
}