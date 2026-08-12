using System.ComponentModel.DataAnnotations;

namespace AthleteHub.API.DTOs;

public class RegisterRequest
{
    [Required]
    public string UniversityId { get; set; } = string.Empty;

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