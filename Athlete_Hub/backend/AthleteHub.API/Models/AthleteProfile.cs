using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class AthleteProfile
{
    public int AthleteId { get; set; }

    public int UserId { get; set; }

    public string StudentNumber { get; set; } = null!;

    public string? Course { get; set; }

    public int? YearLevel { get; set; }

    public DateTime? BirthDate { get; set; }

    public string? ProfilePhotoUrl { get; set; }

    public virtual ICollection<AcademicRecord> AcademicRecords { get; set; } = new List<AcademicRecord>();

    public virtual ICollection<Achievement> Achievements { get; set; } = new List<Achievement>();

    public virtual ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();

    public virtual ICollection<Document> Documents { get; set; } = new List<Document>();

    public virtual ICollection<EligibilityRecord> EligibilityRecords { get; set; } = new List<EligibilityRecord>();

    public virtual ICollection<ParentAthlete> Parents { get; set; } = new List<ParentAthlete>();

    public virtual ICollection<PerformanceRecord> PerformanceRecords { get; set; } = new List<PerformanceRecord>();

    public virtual ICollection<PortfolioItem> PortfolioItems { get; set; } = new List<PortfolioItem>();

    public virtual ICollection<TeamMember> TeamMembers { get; set; } = new List<TeamMember>();

    public virtual User User { get; set; } = null!;
}
