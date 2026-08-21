namespace AthleteHub.API.DTOs;

public class UpdateAdminUserRequest
{
    public int? RoleId { get; set; }

    public string? UniversityId { get; set; }

    public string? Email { get; set; }

    public string? Password { get; set; }

    public string? FirstName { get; set; }

    public string? MiddleName { get; set; }

    public string? LastName { get; set; }

    public string? Phone { get; set; }

    public string? AccountStatus { get; set; }
}