using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class User
{
    public int UserId { get; set; }

    public int RoleId { get; set; }

    public string UniversityId { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public string FirstName { get; set; } = null!;

    public string? MiddleName { get; set; }

    public string LastName { get; set; } = null!;

    public string? Phone { get; set; }

    public string AccountStatus { get; set; } = null!;

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<AcademicImportBatch> AcademicImportBatches { get; set; } = new List<AcademicImportBatch>();

    public virtual ICollection<Achievement> Achievements { get; set; } = new List<Achievement>();

    public virtual ICollection<Announcement> Announcements { get; set; } = new List<Announcement>();

    public virtual AthleteProfile? AthleteProfile { get; set; }

    public virtual CoachProfile? CoachProfile { get; set; }

    public virtual ICollection<Notification> Notifications { get; set; } = new List<Notification>();

    public virtual Role Role { get; set; } = null!;

    public virtual ICollection<Schedule> Schedules { get; set; } = new List<Schedule>();
}
