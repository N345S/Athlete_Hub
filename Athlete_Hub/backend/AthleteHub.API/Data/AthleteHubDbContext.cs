using System;
using System.Collections.Generic;
using AthleteHub.API.Models;
using Microsoft.EntityFrameworkCore;



namespace AthleteHub.API.Data;

public partial class AthleteHubDbContext : DbContext
{
    public AthleteHubDbContext(DbContextOptions<AthleteHubDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AcademicImportBatch> AcademicImportBatches { get; set; }

    public virtual DbSet<AcademicRecord> AcademicRecords { get; set; }

    public virtual DbSet<AcademicTerm> AcademicTerms { get; set; }

    public virtual DbSet<Achievement> Achievements { get; set; }

    public virtual DbSet<Announcement> Announcements { get; set; }

    public virtual DbSet<AthleteProfile> AthleteProfiles { get; set; }

    public virtual DbSet<Attendance> Attendances { get; set; }

    public virtual DbSet<CoachProfile> CoachProfiles { get; set; }

    public virtual DbSet<CoachEvaluation> CoachEvaluations { get; set; }

    public virtual DbSet<Document> Documents { get; set; }

    public virtual DbSet<EligibilityRecord> EligibilityRecords { get; set; }

    public virtual DbSet<Notification> Notifications { get; set; }

    public virtual DbSet<ParentAthlete> ParentAthletes { get; set; }

    public virtual DbSet<PerformanceMetricDefinition> PerformanceMetricDefinitions { get; set; }

    public virtual DbSet<PerformanceRecord> PerformanceRecords { get; set; }

    public virtual DbSet<PortfolioItem> PortfolioItems { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<Schedule> Schedules { get; set; }

    public virtual DbSet<Sport> Sports { get; set; }

    public virtual DbSet<Team> Teams { get; set; }

    public virtual DbSet<TeamMember> TeamMembers { get; set; }

    public virtual DbSet<TrainingSession> TrainingSessions { get; set; }

    public virtual DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AcademicImportBatch>(entity =>
        {
            entity.HasKey(e => e.ImportBatchId).HasName("PRIMARY");

            entity.ToTable("academic_import_batches");

            entity.HasIndex(e => e.ImportedBy, "fk_import_user");

            entity.Property(e => e.ImportBatchId).HasColumnName("import_batch_id");
            entity.Property(e => e.FileName)
                .HasMaxLength(255)
                .HasColumnName("file_name");
            entity.Property(e => e.ImportMethod)
                .HasColumnType("enum('API','FILE_IMPORT','MANUAL')")
                .HasColumnName("import_method");
            entity.Property(e => e.ImportStatus)
                .HasDefaultValueSql("'PENDING'")
                .HasColumnType("enum('PENDING','COMPLETED','FAILED')")
                .HasColumnName("import_status");
            entity.Property(e => e.ImportedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp")
                .HasColumnName("imported_at");
            entity.Property(e => e.ImportedBy).HasColumnName("imported_by");
            entity.Property(e => e.SourceSystem)
                .HasMaxLength(150)
                .HasColumnName("source_system");

            entity.HasOne(d => d.ImportedByNavigation).WithMany(p => p.AcademicImportBatches)
                .HasForeignKey(d => d.ImportedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_import_user");
        });

        modelBuilder.Entity<AcademicRecord>(entity =>
        {
            entity.HasKey(e => e.AcademicRecordId).HasName("PRIMARY");

            entity.ToTable("academic_records");

            entity.HasIndex(e => e.AthleteId, "fk_academic_athlete");

            entity.HasIndex(e => e.ImportBatchId, "fk_academic_import_batch");

            entity.HasIndex(e => e.TermId, "fk_academic_term");

            entity.Property(e => e.AcademicRecordId).HasColumnName("academic_record_id");
            entity.Property(e => e.AthleteId).HasColumnName("athlete_id");
            entity.Property(e => e.Grade)
                .HasPrecision(4)
                .HasColumnName("grade");
            entity.Property(e => e.ImportBatchId).HasColumnName("import_batch_id");
            entity.Property(e => e.ImportedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp")
                .HasColumnName("imported_at");
            entity.Property(e => e.Remarks)
                .HasMaxLength(100)
                .HasColumnName("remarks");
            entity.Property(e => e.SourceType)
                .HasDefaultValueSql("'FILE_IMPORT'")
                .HasColumnType("enum('API','FILE_IMPORT','MANUAL')")
                .HasColumnName("source_type");
            entity.Property(e => e.SubjectCode)
                .HasMaxLength(50)
                .HasColumnName("subject_code");
            entity.Property(e => e.SubjectName)
                .HasMaxLength(150)
                .HasColumnName("subject_name");
            entity.Property(e => e.SectionCode)
                .HasMaxLength(30)
                .HasColumnName("section_code");
            entity.Property(e => e.TermId).HasColumnName("term_id");
            entity.Property(e => e.Units)
                .HasPrecision(4)
                .HasColumnName("units");

            entity.HasOne(d => d.Athlete).WithMany(p => p.AcademicRecords)
                .HasForeignKey(d => d.AthleteId)
                .HasConstraintName("fk_academic_athlete");

            entity.HasOne(d => d.ImportBatch).WithMany(p => p.AcademicRecords)
                .HasForeignKey(d => d.ImportBatchId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_academic_import_batch");

            entity.HasOne(d => d.Term).WithMany(p => p.AcademicRecords)
                .HasForeignKey(d => d.TermId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_academic_term");
        });

        modelBuilder.Entity<CoachEvaluation>(entity =>
        {
            entity.HasKey(e => e.CoachEvaluationId).HasName("PRIMARY");

            entity.ToTable("coach_evaluations");

            entity.HasIndex(e => new { e.AthleteId, e.CoachId, e.TermId }, "coach_evaluation_unique").IsUnique();
            entity.HasIndex(e => e.CoachId, "fk_coach_evaluation_coach");
            entity.HasIndex(e => e.TermId, "fk_coach_evaluation_term");
            entity.HasIndex(e => e.TeamId, "fk_coach_evaluation_team");

            entity.Property(e => e.CoachEvaluationId).HasColumnName("coach_evaluation_id");
            entity.Property(e => e.AthleteId).HasColumnName("athlete_id");
            entity.Property(e => e.CoachId).HasColumnName("coach_id");
            entity.Property(e => e.TermId).HasColumnName("term_id");
            entity.Property(e => e.TeamId).HasColumnName("team_id");
            entity.Property(e => e.Status)
                .HasDefaultValueSql("'PENDING'")
                .HasColumnType("enum('PENDING','SUBMITTED')")
                .HasColumnName("status");
            entity.Property(e => e.Ratings)
                .HasColumnType("text")
                .HasColumnName("ratings");
            entity.Property(e => e.Comments)
                .HasColumnType("text")
                .HasColumnName("comments");
            entity.Property(e => e.SentAt)
                .HasColumnType("timestamp")
                .HasColumnName("sent_at");
            entity.Property(e => e.SubmittedAt)
                .HasColumnType("timestamp")
                .HasColumnName("submitted_at");

            entity.HasOne(d => d.Athlete).WithMany()
                .HasForeignKey(d => d.AthleteId)
                .HasConstraintName("fk_coach_evaluation_athlete");

            entity.HasOne(d => d.Coach).WithMany()
                .HasForeignKey(d => d.CoachId)
                .HasConstraintName("fk_coach_evaluation_coach");

            entity.HasOne(d => d.Term).WithMany()
                .HasForeignKey(d => d.TermId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_coach_evaluation_term");

            entity.HasOne(d => d.Team).WithMany()
                .HasForeignKey(d => d.TeamId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_coach_evaluation_team");
        });

        modelBuilder.Entity<AcademicTerm>(entity =>
        {
            entity.HasKey(e => e.TermId).HasName("PRIMARY");

            entity.ToTable("academic_terms");

            entity.HasIndex(e => new { e.AcademicYear, e.Semester }, "academic_year").IsUnique();

            entity.Property(e => e.TermId).HasColumnName("term_id");
            entity.Property(e => e.AcademicYear)
                .HasMaxLength(20)
                .HasColumnName("academic_year");
            entity.Property(e => e.EndDate)
                .HasColumnType("date")
                .HasColumnName("end_date");
            entity.Property(e => e.StartDate)
                .HasColumnType("date")
                .HasColumnName("start_date");
            entity.Property(e => e.Semester)
                .HasMaxLength(100)
                .HasColumnName("semester");
        });

        modelBuilder.Entity<Achievement>(entity =>
        {
            entity.HasKey(e => e.AchievementId).HasName("PRIMARY");

            entity.ToTable("achievements");

            entity.HasIndex(e => e.AthleteId, "fk_achievement_athlete");

            entity.HasIndex(e => e.VerifiedBy, "fk_achievement_verifier");

            entity.Property(e => e.AchievementId).HasColumnName("achievement_id");
            entity.Property(e => e.AchievementDate)
                .HasColumnType("date")
                .HasColumnName("achievement_date");
            entity.Property(e => e.AthleteId).HasColumnName("athlete_id");
            entity.Property(e => e.Category)
                .HasMaxLength(100)
                .HasColumnName("category");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp")
                .HasColumnName("created_at");
            entity.Property(e => e.Description)
                .HasColumnType("text")
                .HasColumnName("description");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");
            entity.Property(e => e.VerificationStatus)
                .HasDefaultValueSql("'PENDING'")
                .HasColumnType("enum('PENDING','VERIFIED','REJECTED')")
                .HasColumnName("verification_status");
            entity.Property(e => e.RejectionReason)
                .HasColumnType("text")
                .HasColumnName("rejection_reason");
            entity.Property(e => e.VerifiedAt)
                .HasColumnType("timestamp")
                .HasColumnName("verified_at");
            entity.Property(e => e.VerifiedBy).HasColumnName("verified_by");

            entity.HasOne(d => d.Athlete).WithMany(p => p.Achievements)
                .HasForeignKey(d => d.AthleteId)
                .HasConstraintName("fk_achievement_athlete");

            entity.HasOne(d => d.VerifiedByNavigation).WithMany(p => p.Achievements)
                .HasForeignKey(d => d.VerifiedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_achievement_verifier");
        });

        modelBuilder.Entity<Announcement>(entity =>
        {
            entity.HasKey(e => e.AnnouncementId).HasName("PRIMARY");

            entity.ToTable("announcements");

            entity.HasIndex(e => e.CreatedBy, "fk_announcement_creator");

            entity.Property(e => e.AnnouncementId).HasColumnName("announcement_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.Message)
                .HasColumnType("text")
                .HasColumnName("message");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Announcements)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_announcement_creator");
        });

        modelBuilder.Entity<AthleteProfile>(entity =>
        {
            entity.HasKey(e => e.AthleteId).HasName("PRIMARY");

            entity.ToTable("athlete_profiles");

            entity.HasIndex(e => e.StudentNumber, "student_number").IsUnique();

            entity.HasIndex(e => e.UserId, "user_id").IsUnique();

            entity.Property(e => e.AthleteId).HasColumnName("athlete_id");
            entity.Property(e => e.BirthDate)
                .HasColumnType("date")
                .HasColumnName("birth_date");
            entity.Property(e => e.Course)
                .HasMaxLength(150)
                .HasColumnName("course");
            entity.Property(e => e.ProfilePhotoUrl)
                .HasMaxLength(500)
                .HasColumnName("profile_photo_url");
            entity.Property(e => e.StudentNumber)
                .HasMaxLength(50)
                .HasColumnName("student_number");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.YearLevel).HasColumnName("year_level");

            entity.HasOne(d => d.User).WithOne(p => p.AthleteProfile)
                .HasForeignKey<AthleteProfile>(d => d.UserId)
                .HasConstraintName("fk_athlete_user");
        });

        modelBuilder.Entity<Attendance>(entity =>
        {
            entity.HasKey(e => e.AttendanceId).HasName("PRIMARY");

            entity.ToTable("attendance");

            entity.HasIndex(e => e.AthleteId, "fk_attendance_athlete");

            entity.HasIndex(e => new { e.TrainingSessionId, e.AthleteId }, "training_session_id").IsUnique();

            entity.Property(e => e.AttendanceId).HasColumnName("attendance_id");
            entity.Property(e => e.AthleteId).HasColumnName("athlete_id");
            entity.Property(e => e.AttendanceStatus)
                .HasColumnType("enum('PRESENT','ABSENT','LATE','EXCUSED')")
                .HasColumnName("attendance_status");
            entity.Property(e => e.Remarks)
                .HasMaxLength(255)
                .HasColumnName("remarks");
            entity.Property(e => e.TrainingSessionId).HasColumnName("training_session_id");

            entity.HasOne(d => d.Athlete).WithMany(p => p.Attendances)
                .HasForeignKey(d => d.AthleteId)
                .HasConstraintName("fk_attendance_athlete");

            entity.HasOne(d => d.TrainingSession).WithMany(p => p.Attendances)
                .HasForeignKey(d => d.TrainingSessionId)
                .HasConstraintName("fk_attendance_session");
        });

        modelBuilder.Entity<CoachProfile>(entity =>
        {
            entity.HasKey(e => e.CoachId).HasName("PRIMARY");

            entity.ToTable("coach_profiles");

            entity.HasIndex(e => e.UserId, "user_id").IsUnique();

            entity.Property(e => e.CoachId).HasColumnName("coach_id");
            entity.Property(e => e.Specialization)
                .HasMaxLength(150)
                .HasColumnName("specialization");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.User).WithOne(p => p.CoachProfile)
                .HasForeignKey<CoachProfile>(d => d.UserId)
                .HasConstraintName("fk_coach_user");
        });

        modelBuilder.Entity<Document>(entity =>
        {
            entity.HasKey(e => e.DocumentId).HasName("PRIMARY");

            entity.ToTable("documents");

            entity.HasIndex(e => e.AthleteId, "fk_document_athlete");

            entity.HasIndex(e => e.AchievementId, "fk_document_achievement");

            entity.Property(e => e.DocumentId).HasColumnName("document_id");
            entity.Property(e => e.AthleteId).HasColumnName("athlete_id");
            entity.Property(e => e.AchievementId).HasColumnName("achievement_id");
            entity.Property(e => e.DocumentName)
                .HasMaxLength(255)
                .HasColumnName("document_name");
            entity.Property(e => e.DocumentType)
                .HasMaxLength(100)
                .HasColumnName("document_type");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");
            entity.Property(e => e.Description)
                .HasColumnType("text")
                .HasColumnName("description");
            entity.Property(e => e.FileUrl)
                .HasMaxLength(500)
                .HasColumnName("file_url");
            entity.Property(e => e.Status)
                .HasDefaultValueSql("'PENDING'")
                .HasColumnType("enum('PENDING','APPROVED','REJECTED')")
                .HasColumnName("status");
            entity.Property(e => e.UploadedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp")
                .HasColumnName("uploaded_at");

            entity.HasOne(d => d.Athlete).WithMany(p => p.Documents)
                .HasForeignKey(d => d.AthleteId)
                .HasConstraintName("fk_document_athlete");

            entity.HasOne(d => d.Achievement).WithMany()
                .HasForeignKey(d => d.AchievementId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_document_achievement");
        });

        modelBuilder.Entity<EligibilityRecord>(entity =>
        {
            entity.HasKey(e => e.EligibilityId).HasName("PRIMARY");

            entity.ToTable("eligibility_records");

            entity.HasIndex(e => new { e.AthleteId, e.TermId }, "athlete_id").IsUnique();

            entity.HasIndex(e => e.TermId, "fk_eligibility_term");

            entity.Property(e => e.EligibilityId).HasColumnName("eligibility_id");
            entity.Property(e => e.AcademicStatus)
                .HasDefaultValueSql("'PENDING'")
                .HasColumnType("enum('ELIGIBLE','AT_RISK','INELIGIBLE','PENDING')")
                .HasColumnName("academic_status");
            entity.Property(e => e.AthleteId).HasColumnName("athlete_id");
            entity.Property(e => e.DocumentId).HasColumnName("document_id");
            entity.Property(e => e.EvaluatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp")
                .HasColumnName("evaluated_at");
            entity.Property(e => e.EligibilityReasons)
                .HasColumnType("longtext")
                .HasColumnName("eligibility_reasons");
            entity.Property(e => e.RequestedAt)
                .HasColumnType("timestamp")
                .HasColumnName("requested_at");
            entity.Property(e => e.RequestedBy).HasColumnName("requested_by");
            entity.Property(e => e.ReviewedAt)
                .HasColumnType("timestamp")
                .HasColumnName("reviewed_at");
            entity.Property(e => e.Remarks)
                .HasColumnType("text")
                .HasColumnName("remarks");
            entity.Property(e => e.TermId).HasColumnName("term_id");
            entity.Property(e => e.UploadedBy).HasColumnName("uploaded_by");
            entity.Property(e => e.ReviewedBy).HasColumnName("reviewed_by");

            entity.HasIndex(e => e.DocumentId, "fk_eligibility_document");
            entity.HasIndex(e => e.RequestedBy, "fk_eligibility_requested_by");
            entity.HasIndex(e => e.UploadedBy, "fk_eligibility_uploaded_by");
            entity.HasIndex(e => e.ReviewedBy, "fk_eligibility_reviewed_by");

            entity.HasOne(d => d.Athlete).WithMany(p => p.EligibilityRecords)
                .HasForeignKey(d => d.AthleteId)
                .HasConstraintName("fk_eligibility_athlete");

            entity.HasOne(d => d.Term).WithMany(p => p.EligibilityRecords)
                .HasForeignKey(d => d.TermId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_eligibility_term");

            entity.HasOne<Document>().WithMany()
                .HasForeignKey(d => d.DocumentId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_eligibility_document");

            entity.HasOne<User>().WithMany()
                .HasForeignKey(d => d.RequestedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_eligibility_requested_by");

            entity.HasOne<User>().WithMany()
                .HasForeignKey(d => d.UploadedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_eligibility_uploaded_by");

            entity.HasOne<User>().WithMany()
                .HasForeignKey(d => d.ReviewedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_eligibility_reviewed_by");
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(e => e.NotificationId).HasName("PRIMARY");

            entity.ToTable("notifications");

            entity.HasIndex(e => e.UserId, "fk_notification_user");

            entity.Property(e => e.NotificationId).HasColumnName("notification_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp")
                .HasColumnName("created_at");
            entity.Property(e => e.IsRead)
                .HasDefaultValueSql("'0'")
                .HasColumnName("is_read");
            entity.Property(e => e.Message)
                .HasColumnType("text")
                .HasColumnName("message");
            entity.Property(e => e.NotificationType)
                .HasMaxLength(50)
                .HasColumnName("notification_type");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.User).WithMany(p => p.Notifications)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("fk_notification_user");
        });

        modelBuilder.Entity<ParentAthlete>(entity =>
        {
            entity.HasKey(e => e.ParentAthleteId).HasName("PRIMARY");

            entity.ToTable("parent_athletes");

            entity.HasIndex(e => new { e.ParentUserId, e.AthleteId }, "parent_athlete_unique").IsUnique();

            entity.HasIndex(e => e.AthleteId, "fk_parent_athlete_athlete");

            entity.Property(e => e.ParentAthleteId).HasColumnName("parent_athlete_id");
            entity.Property(e => e.ParentUserId).HasColumnName("parent_user_id");
            entity.Property(e => e.AthleteId).HasColumnName("athlete_id");
            entity.Property(e => e.Relationship)
                .HasMaxLength(50)
                .HasColumnName("relationship");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp")
                .HasColumnName("created_at");

            entity.HasOne(d => d.ParentUser).WithMany(p => p.Children)
                .HasForeignKey(d => d.ParentUserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_parent_athlete_parent");

            entity.HasOne(d => d.Athlete).WithMany(p => p.Parents)
                .HasForeignKey(d => d.AthleteId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_parent_athlete_athlete");
        });

        modelBuilder.Entity<PerformanceMetricDefinition>(entity =>
        {
            entity.HasKey(e => e.MetricId).HasName("PRIMARY");

            entity.ToTable("performance_metric_definitions");

            entity.HasIndex(e => e.SportId, "fk_metric_sport");

            entity.Property(e => e.MetricId).HasColumnName("metric_id");
            entity.Property(e => e.Description)
                .HasMaxLength(255)
                .HasColumnName("description");
            entity.Property(e => e.MetricName)
                .HasMaxLength(100)
                .HasColumnName("metric_name");
            entity.Property(e => e.SportId).HasColumnName("sport_id");
            entity.Property(e => e.Unit)
                .HasMaxLength(50)
                .HasColumnName("unit");
            entity.Property(e => e.DataType)
                .HasMaxLength(50)
                .HasColumnName("data_type");

            entity.HasOne(d => d.Sport).WithMany(p => p.PerformanceMetricDefinitions)
                .HasForeignKey(d => d.SportId)
                .HasConstraintName("fk_metric_sport");
        });

        modelBuilder.Entity<PerformanceRecord>(entity =>
        {
            entity.HasKey(e => e.PerformanceRecordId).HasName("PRIMARY");

            entity.ToTable("performance_records");

            entity.HasIndex(e => e.AthleteId, "fk_performance_athlete");

            entity.HasIndex(e => e.CoachId, "fk_performance_coach");

            entity.HasIndex(e => e.MetricId, "fk_performance_metric");

            entity.Property(e => e.PerformanceRecordId).HasColumnName("performance_record_id");
            entity.Property(e => e.AthleteId).HasColumnName("athlete_id");
            entity.Property(e => e.CoachId).HasColumnName("coach_id");
            entity.Property(e => e.MetricId).HasColumnName("metric_id");
            entity.Property(e => e.Notes)
                .HasColumnType("text")
                .HasColumnName("notes");
            entity.Property(e => e.RecordedDate)
                .HasColumnType("date")
                .HasColumnName("recorded_date");
            entity.Property(e => e.RecordedValue)
                .HasPrecision(10)
                .HasColumnName("recorded_value");
            entity.Property(e => e.DataType)
                .HasMaxLength(50)
                .HasColumnName("data_type");
            entity.Property(e => e.Unit)
                .HasMaxLength(30)
                .HasColumnName("unit");
            entity.Property(e => e.SessionId)
                .HasColumnName("session_id");

            entity.HasOne(d => d.Athlete).WithMany(p => p.PerformanceRecords)
                .HasForeignKey(d => d.AthleteId)
                .HasConstraintName("fk_performance_athlete");

            entity.HasOne(d => d.Coach).WithMany(p => p.PerformanceRecords)
                .HasForeignKey(d => d.CoachId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_performance_coach");

            entity.HasOne(d => d.Metric).WithMany(p => p.PerformanceRecords)
                .HasForeignKey(d => d.MetricId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_performance_metric");

            entity.HasOne(d => d.Session).WithMany()
                .HasForeignKey(d => d.SessionId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_performance_session");
        });

        modelBuilder.Entity<PortfolioItem>(entity =>
        {
            entity.HasKey(e => e.PortfolioItemId).HasName("PRIMARY");

            entity.ToTable("portfolio_items");

            entity.HasIndex(e => e.AchievementId, "fk_portfolio_achievement");

            entity.HasIndex(e => e.AthleteId, "fk_portfolio_athlete");

            entity.Property(e => e.PortfolioItemId).HasColumnName("portfolio_item_id");
            entity.Property(e => e.AchievementId).HasColumnName("achievement_id");
            entity.Property(e => e.AthleteId).HasColumnName("athlete_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp")
                .HasColumnName("created_at");
            entity.Property(e => e.Description)
                .HasColumnType("text")
                .HasColumnName("description");
            entity.Property(e => e.DisplayOrder)
                .HasDefaultValueSql("'0'")
                .HasColumnName("display_order");
            entity.Property(e => e.IsVisible)
                .HasDefaultValueSql("'1'")
                .HasColumnName("is_visible");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");
            entity.Property(e => e.VerificationStatus)
                .HasMaxLength(20)
                .HasColumnName("verification_status");
            entity.Property(e => e.VerifiedBy).HasColumnName("verified_by");
            entity.Property(e => e.VerifiedAt)
                .HasColumnType("timestamp")
                .HasColumnName("verified_at");
            entity.Property(e => e.RejectionReason)
                .HasColumnType("text")
                .HasColumnName("rejection_reason");

            entity.HasOne(d => d.Achievement).WithMany(p => p.PortfolioItems)
                .HasForeignKey(d => d.AchievementId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_portfolio_achievement");

            entity.HasOne(d => d.Athlete).WithMany(p => p.PortfolioItems)
                .HasForeignKey(d => d.AthleteId)
                .HasConstraintName("fk_portfolio_athlete");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.RoleId).HasName("PRIMARY");

            entity.ToTable("roles");

            entity.HasIndex(e => e.RoleName, "role_name").IsUnique();

            entity.Property(e => e.RoleId).HasColumnName("role_id");
            entity.Property(e => e.Description)
                .HasMaxLength(255)
                .HasColumnName("description");
            entity.Property(e => e.RoleName)
                .HasMaxLength(50)
                .HasColumnName("role_name");
        });

        modelBuilder.Entity<Schedule>(entity =>
        {
            entity.HasKey(e => e.ScheduleId).HasName("PRIMARY");

            entity.ToTable("schedules");

            entity.HasIndex(e => e.CreatedBy, "fk_schedule_creator");

            entity.Property(e => e.ScheduleId).HasColumnName("schedule_id");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.Description)
                .HasColumnType("text")
                .HasColumnName("description");
            entity.Property(e => e.EndDatetime)
                .HasColumnType("datetime")
                .HasColumnName("end_datetime");
            entity.Property(e => e.Location)
                .HasMaxLength(200)
                .HasColumnName("location");
            entity.Property(e => e.ScheduleType)
                .HasColumnType("enum('TRAINING','COMPETITION','ACADEMIC','MEETING','OTHER','SCHOOL_EVENT','SPORTS_EVENT')")
                .HasColumnName("schedule_type");
            entity.Property(e => e.CancellationReason)
                .HasColumnType("text")
                .HasColumnName("cancellation_reason");
            entity.Property(e => e.CancelledAt)
                .HasColumnType("timestamp")
                .HasColumnName("cancelled_at");
            entity.Property(e => e.RescheduleReason)
                .HasColumnType("text")
                .HasColumnName("reschedule_reason");
            entity.Property(e => e.RescheduledAt)
                .HasColumnType("timestamp")
                .HasColumnName("rescheduled_at");
            entity.Property(e => e.StartDatetime)
                .HasColumnType("datetime")
                .HasColumnName("start_datetime");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Schedules)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_schedule_creator");
        });

        modelBuilder.Entity<Sport>(entity =>
        {
            entity.HasKey(e => e.SportId).HasName("PRIMARY");

            entity.ToTable("sports");

            entity.HasIndex(e => e.SportName, "sport_name").IsUnique();

            entity.Property(e => e.SportId).HasColumnName("sport_id");
            entity.Property(e => e.Description)
                .HasColumnType("text")
                .HasColumnName("description");
            entity.Property(e => e.SportName)
                .HasMaxLength(100)
                .HasColumnName("sport_name");
            entity.Property(e => e.SportType)
                .HasColumnType("enum('INDIVIDUAL','TEAM')")
                .HasColumnName("sport_type");
        });

        modelBuilder.Entity<Team>(entity =>
        {
            entity.HasKey(e => e.TeamId).HasName("PRIMARY");

            entity.ToTable("teams");

            entity.HasIndex(e => e.CoachId, "fk_team_coach");

            entity.HasIndex(e => e.SportId, "fk_team_sport");

            entity.Property(e => e.TeamId).HasColumnName("team_id");
            entity.Property(e => e.CoachId).HasColumnName("coach_id");
            entity.Property(e => e.SchoolYear)
                .HasMaxLength(20)
                .HasColumnName("school_year");
            entity.Property(e => e.SportId).HasColumnName("sport_id");
            entity.Property(e => e.Status)
                .HasDefaultValueSql("'ACTIVE'")
                .HasColumnType("enum('ACTIVE','INACTIVE')")
                .HasColumnName("status");
            entity.Property(e => e.TeamName)
                .HasMaxLength(100)
                .HasColumnName("team_name");

            entity.HasOne(d => d.Coach).WithMany(p => p.Teams)
                .HasForeignKey(d => d.CoachId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_team_coach");

            entity.HasOne(d => d.Sport).WithMany(p => p.Teams)
                .HasForeignKey(d => d.SportId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_team_sport");
        });

        modelBuilder.Entity<TeamMember>(entity =>
        {
            entity.HasKey(e => e.TeamMemberId).HasName("PRIMARY");

            entity.ToTable("team_members");

            entity.HasIndex(e => e.AthleteId, "fk_member_athlete");

            entity.HasIndex(e => new { e.TeamId, e.AthleteId }, "team_id").IsUnique();

            entity.Property(e => e.TeamMemberId).HasColumnName("team_member_id");
            entity.Property(e => e.AthleteId).HasColumnName("athlete_id");
            entity.Property(e => e.DateJoined)
                .HasColumnType("date")
                .HasColumnName("date_joined");
            entity.Property(e => e.DateLeft)
                .HasColumnType("date")
                .HasColumnName("date_left");
            entity.Property(e => e.TeamId).HasColumnName("team_id");

            entity.HasOne(d => d.Athlete).WithMany(p => p.TeamMembers)
                .HasForeignKey(d => d.AthleteId)
                .HasConstraintName("fk_member_athlete");

            entity.HasOne(d => d.Team).WithMany(p => p.TeamMembers)
                .HasForeignKey(d => d.TeamId)
                .HasConstraintName("fk_member_team");
        });

        modelBuilder.Entity<TrainingSession>(entity =>
        {
            entity.HasKey(e => e.TrainingSessionId).HasName("PRIMARY");

            entity.ToTable("training_sessions");

            entity.HasIndex(e => e.CoachId, "fk_training_coach");

            entity.HasIndex(e => e.TeamId, "fk_training_team");

            entity.Property(e => e.TrainingSessionId).HasColumnName("training_session_id");
            entity.Property(e => e.CoachId).HasColumnName("coach_id");
            entity.Property(e => e.Description)
                .HasColumnType("text")
                .HasColumnName("description");
            entity.Property(e => e.ApprovalStatus)
                .HasMaxLength(20)
                .HasDefaultValue("APPROVED")
                .HasColumnName("approval_status");
            entity.Property(e => e.SubmittedAt)
                .HasColumnType("timestamp")
                .HasColumnName("submitted_at");
            entity.Property(e => e.ReviewedAt)
                .HasColumnType("timestamp")
                .HasColumnName("reviewed_at");
            entity.Property(e => e.ReviewedBy).HasColumnName("reviewed_by");
            entity.Property(e => e.RejectionReason)
                .HasColumnType("text")
                .HasColumnName("rejection_reason");
            entity.Property(e => e.CancellationReason)
                .HasColumnType("text")
                .HasColumnName("cancellation_reason");
            entity.Property(e => e.CancelledAt)
                .HasColumnType("timestamp")
                .HasColumnName("cancelled_at");
            entity.Property(e => e.RescheduleReason)
                .HasColumnType("text")
                .HasColumnName("reschedule_reason");
            entity.Property(e => e.RescheduledAt)
                .HasColumnType("timestamp")
                .HasColumnName("rescheduled_at");
            entity.Property(e => e.EndTime)
                .HasColumnType("time")
                .HasColumnName("end_time");
            entity.Property(e => e.Location)
                .HasMaxLength(200)
                .HasColumnName("location");
            entity.Property(e => e.StartTime)
                .HasColumnType("time")
                .HasColumnName("start_time");
            entity.Property(e => e.TeamId).HasColumnName("team_id");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");
            entity.Property(e => e.TrainingDate)
                .HasColumnType("date")
                .HasColumnName("training_date");

            entity.HasOne(d => d.Coach).WithMany(p => p.TrainingSessions)
                .HasForeignKey(d => d.CoachId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_training_coach");

            entity.HasOne(d => d.Team).WithMany(p => p.TrainingSessions)
                .HasForeignKey(d => d.TeamId)
                .HasConstraintName("fk_training_team");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.UserId).HasName("PRIMARY");

            entity.ToTable("users");

            entity.HasIndex(e => e.Email, "email").IsUnique();

            entity.HasIndex(e => e.RoleId, "fk_users_role");

            entity.HasIndex(e => e.UniversityId, "university_id").IsUnique();

            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.AccountStatus)
                .HasDefaultValueSql("'ACTIVE'")
                .HasColumnType("enum('ACTIVE','INACTIVE','SUSPENDED')")
                .HasColumnName("account_status");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp")
                .HasColumnName("created_at");
            entity.Property(e => e.Email)
                .HasMaxLength(150)
                .HasColumnName("email");
            entity.Property(e => e.FirstName)
                .HasMaxLength(100)
                .HasColumnName("first_name");
            entity.Property(e => e.LastName)
                .HasMaxLength(100)
                .HasColumnName("last_name");
            entity.Property(e => e.MiddleName)
                .HasMaxLength(100)
                .HasColumnName("middle_name");
            entity.Property(e => e.PasswordHash)
                .HasMaxLength(255)
                .HasColumnName("password_hash");
            entity.Property(e => e.ConfidentialPasswordHash)
                .HasMaxLength(255)
                .HasColumnName("confidential_password_hash");
            entity.Property(e => e.Phone)
                .HasMaxLength(30)
                .HasColumnName("phone");
            entity.Property(e => e.RoleId).HasColumnName("role_id");
            entity.Property(e => e.UniversityId)
                .HasMaxLength(50)
                .HasColumnName("university_id");
            entity.Property(e => e.UpdatedAt)
                .ValueGeneratedOnAddOrUpdate()
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("timestamp")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Role).WithMany(p => p.Users)
                .HasForeignKey(d => d.RoleId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_users_role");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
