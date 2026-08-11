using System;
using System.Collections.Generic;

namespace AthleteHub.API.Models;

public partial class Announcement
{
    public int AnnouncementId { get; set; }

    public int CreatedBy { get; set; }

    public string Title { get; set; } = null!;

    public string Message { get; set; } = null!;

    public DateTime? CreatedAt { get; set; }

    public virtual User CreatedByNavigation { get; set; } = null!;
}
