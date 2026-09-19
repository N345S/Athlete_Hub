using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace AthleteHub.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialAthleteHubSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "academic_terms",
                columns: table => new
                {
                    term_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    academic_year = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    semester = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    start_date = table.Column<DateTime>(type: "date", nullable: true),
                    end_date = table.Column<DateTime>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.term_id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    role_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    role_name = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    description = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.role_id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "sports",
                columns: table => new
                {
                    sport_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    sport_name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    sport_type = table.Column<string>(type: "enum('INDIVIDUAL','TEAM')", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.sport_id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    user_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    role_id = table.Column<int>(type: "int", nullable: false),
                    university_id = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    email = table.Column<string>(type: "varchar(150)", maxLength: 150, nullable: false),
                    password_hash = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                    first_name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    middle_name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    last_name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    phone = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    account_status = table.Column<string>(type: "enum('ACTIVE','INACTIVE','SUSPENDED')", nullable: false, defaultValueSql: "'ACTIVE'"),
                    created_at = table.Column<DateTime>(type: "timestamp", nullable: true, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updated_at = table.Column<DateTime>(type: "timestamp", nullable: true, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.user_id);
                    table.ForeignKey(
                        name: "fk_users_role",
                        column: x => x.role_id,
                        principalTable: "roles",
                        principalColumn: "role_id");
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "performance_metric_definitions",
                columns: table => new
                {
                    metric_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    sport_id = table.Column<int>(type: "int", nullable: false),
                    metric_name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    unit = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    data_type = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.metric_id);
                    table.ForeignKey(
                        name: "fk_metric_sport",
                        column: x => x.sport_id,
                        principalTable: "sports",
                        principalColumn: "sport_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "academic_import_batches",
                columns: table => new
                {
                    import_batch_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    source_system = table.Column<string>(type: "varchar(150)", maxLength: 150, nullable: false),
                    import_method = table.Column<string>(type: "enum('API','FILE_IMPORT','MANUAL')", nullable: false),
                    file_name = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    imported_by = table.Column<int>(type: "int", nullable: true),
                    import_status = table.Column<string>(type: "enum('PENDING','COMPLETED','FAILED')", nullable: false, defaultValueSql: "'PENDING'"),
                    imported_at = table.Column<DateTime>(type: "timestamp", nullable: true, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.import_batch_id);
                    table.ForeignKey(
                        name: "fk_import_user",
                        column: x => x.imported_by,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "announcements",
                columns: table => new
                {
                    announcement_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    title = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    message = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp", nullable: true, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.announcement_id);
                    table.ForeignKey(
                        name: "fk_announcement_creator",
                        column: x => x.created_by,
                        principalTable: "users",
                        principalColumn: "user_id");
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "athlete_profiles",
                columns: table => new
                {
                    athlete_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    user_id = table.Column<int>(type: "int", nullable: false),
                    student_number = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    course = table.Column<string>(type: "varchar(150)", maxLength: 150, nullable: true),
                    year_level = table.Column<int>(type: "int", nullable: true),
                    birth_date = table.Column<DateTime>(type: "date", nullable: true),
                    profile_photo_url = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.athlete_id);
                    table.ForeignKey(
                        name: "fk_athlete_user",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "coach_profiles",
                columns: table => new
                {
                    coach_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    user_id = table.Column<int>(type: "int", nullable: false),
                    specialization = table.Column<string>(type: "varchar(150)", maxLength: 150, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.coach_id);
                    table.ForeignKey(
                        name: "fk_coach_user",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    notification_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    user_id = table.Column<int>(type: "int", nullable: false),
                    title = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    message = table.Column<string>(type: "text", nullable: false),
                    notification_type = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    is_read = table.Column<bool>(type: "tinyint(1)", nullable: true, defaultValueSql: "'0'"),
                    created_at = table.Column<DateTime>(type: "timestamp", nullable: true, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.notification_id);
                    table.ForeignKey(
                        name: "fk_notification_user",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "schedules",
                columns: table => new
                {
                    schedule_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    title = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    schedule_type = table.Column<string>(type: "enum('TRAINING','COMPETITION','ACADEMIC','MEETING','OTHER')", nullable: false),
                    start_datetime = table.Column<DateTime>(type: "datetime", nullable: false),
                    end_datetime = table.Column<DateTime>(type: "datetime", nullable: true),
                    location = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                    created_by = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.schedule_id);
                    table.ForeignKey(
                        name: "fk_schedule_creator",
                        column: x => x.created_by,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "academic_records",
                columns: table => new
                {
                    academic_record_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    athlete_id = table.Column<int>(type: "int", nullable: false),
                    term_id = table.Column<int>(type: "int", nullable: false),
                    import_batch_id = table.Column<int>(type: "int", nullable: true),
                    subject_code = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    subject_name = table.Column<string>(type: "varchar(150)", maxLength: 150, nullable: false),
                    units = table.Column<decimal>(type: "decimal(4,2)", precision: 4, nullable: true),
                    grade = table.Column<decimal>(type: "decimal(4,2)", precision: 4, nullable: true),
                    remarks = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    source_type = table.Column<string>(type: "enum('API','FILE_IMPORT','MANUAL')", nullable: false, defaultValueSql: "'FILE_IMPORT'"),
                    imported_at = table.Column<DateTime>(type: "timestamp", nullable: true, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.academic_record_id);
                    table.ForeignKey(
                        name: "fk_academic_athlete",
                        column: x => x.athlete_id,
                        principalTable: "athlete_profiles",
                        principalColumn: "athlete_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_academic_import_batch",
                        column: x => x.import_batch_id,
                        principalTable: "academic_import_batches",
                        principalColumn: "import_batch_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_academic_term",
                        column: x => x.term_id,
                        principalTable: "academic_terms",
                        principalColumn: "term_id");
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "achievements",
                columns: table => new
                {
                    achievement_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    athlete_id = table.Column<int>(type: "int", nullable: false),
                    title = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    achievement_date = table.Column<DateTime>(type: "date", nullable: true),
                    category = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    verification_status = table.Column<string>(type: "enum('PENDING','VERIFIED','REJECTED')", nullable: false, defaultValueSql: "'PENDING'"),
                    verified_by = table.Column<int>(type: "int", nullable: true),
                    verified_at = table.Column<DateTime>(type: "timestamp", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp", nullable: true, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.achievement_id);
                    table.ForeignKey(
                        name: "fk_achievement_athlete",
                        column: x => x.athlete_id,
                        principalTable: "athlete_profiles",
                        principalColumn: "athlete_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_achievement_verifier",
                        column: x => x.verified_by,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "eligibility_records",
                columns: table => new
                {
                    eligibility_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    athlete_id = table.Column<int>(type: "int", nullable: false),
                    term_id = table.Column<int>(type: "int", nullable: false),
                    academic_status = table.Column<string>(type: "enum('ELIGIBLE','AT_RISK','INELIGIBLE','PENDING')", nullable: false, defaultValueSql: "'PENDING'"),
                    remarks = table.Column<string>(type: "text", nullable: true),
                    evaluated_at = table.Column<DateTime>(type: "timestamp", nullable: true, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.eligibility_id);
                    table.ForeignKey(
                        name: "fk_eligibility_athlete",
                        column: x => x.athlete_id,
                        principalTable: "athlete_profiles",
                        principalColumn: "athlete_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_eligibility_term",
                        column: x => x.term_id,
                        principalTable: "academic_terms",
                        principalColumn: "term_id");
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "teams",
                columns: table => new
                {
                    team_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    sport_id = table.Column<int>(type: "int", nullable: false),
                    coach_id = table.Column<int>(type: "int", nullable: true),
                    team_name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    school_year = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    status = table.Column<string>(type: "enum('ACTIVE','INACTIVE')", nullable: false, defaultValueSql: "'ACTIVE'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.team_id);
                    table.ForeignKey(
                        name: "fk_team_coach",
                        column: x => x.coach_id,
                        principalTable: "coach_profiles",
                        principalColumn: "coach_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_team_sport",
                        column: x => x.sport_id,
                        principalTable: "sports",
                        principalColumn: "sport_id");
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "documents",
                columns: table => new
                {
                    document_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    athlete_id = table.Column<int>(type: "int", nullable: false),
                    achievement_id = table.Column<int>(type: "int", nullable: true),
                    document_type = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    title = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                    description = table.Column<string>(type: "text", nullable: true),
                    document_name = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                    file_url = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: false),
                    status = table.Column<string>(type: "enum('PENDING','APPROVED','REJECTED')", nullable: false, defaultValueSql: "'PENDING'"),
                    uploaded_at = table.Column<DateTime>(type: "timestamp", nullable: true, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.document_id);
                    table.ForeignKey(
                        name: "fk_document_achievement",
                        column: x => x.achievement_id,
                        principalTable: "achievements",
                        principalColumn: "achievement_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_document_athlete",
                        column: x => x.athlete_id,
                        principalTable: "athlete_profiles",
                        principalColumn: "athlete_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "portfolio_items",
                columns: table => new
                {
                    portfolio_item_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    athlete_id = table.Column<int>(type: "int", nullable: false),
                    achievement_id = table.Column<int>(type: "int", nullable: true),
                    title = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    display_order = table.Column<int>(type: "int", nullable: true, defaultValueSql: "'0'"),
                    is_visible = table.Column<bool>(type: "tinyint(1)", nullable: true, defaultValueSql: "'1'"),
                    created_at = table.Column<DateTime>(type: "timestamp", nullable: true, defaultValueSql: "CURRENT_TIMESTAMP"),
                    verification_status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    verified_by = table.Column<int>(type: "int", nullable: true),
                    verified_at = table.Column<DateTime>(type: "timestamp", nullable: true),
                    rejection_reason = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.portfolio_item_id);
                    table.ForeignKey(
                        name: "fk_portfolio_achievement",
                        column: x => x.achievement_id,
                        principalTable: "achievements",
                        principalColumn: "achievement_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_portfolio_athlete",
                        column: x => x.athlete_id,
                        principalTable: "athlete_profiles",
                        principalColumn: "athlete_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "team_members",
                columns: table => new
                {
                    team_member_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    team_id = table.Column<int>(type: "int", nullable: false),
                    athlete_id = table.Column<int>(type: "int", nullable: false),
                    date_joined = table.Column<DateTime>(type: "date", nullable: true),
                    date_left = table.Column<DateTime>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.team_member_id);
                    table.ForeignKey(
                        name: "fk_member_athlete",
                        column: x => x.athlete_id,
                        principalTable: "athlete_profiles",
                        principalColumn: "athlete_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_member_team",
                        column: x => x.team_id,
                        principalTable: "teams",
                        principalColumn: "team_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "training_sessions",
                columns: table => new
                {
                    training_session_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    team_id = table.Column<int>(type: "int", nullable: false),
                    coach_id = table.Column<int>(type: "int", nullable: false),
                    title = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    training_date = table.Column<DateTime>(type: "date", nullable: false),
                    start_time = table.Column<TimeSpan>(type: "time", nullable: true),
                    end_time = table.Column<TimeSpan>(type: "time", nullable: true),
                    location = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                    approval_status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "APPROVED"),
                    submitted_at = table.Column<DateTime>(type: "timestamp", nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "timestamp", nullable: true),
                    reviewed_by = table.Column<int>(type: "int", nullable: true),
                    rejection_reason = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.training_session_id);
                    table.ForeignKey(
                        name: "fk_training_coach",
                        column: x => x.coach_id,
                        principalTable: "coach_profiles",
                        principalColumn: "coach_id");
                    table.ForeignKey(
                        name: "fk_training_team",
                        column: x => x.team_id,
                        principalTable: "teams",
                        principalColumn: "team_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "attendance",
                columns: table => new
                {
                    attendance_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    training_session_id = table.Column<int>(type: "int", nullable: false),
                    athlete_id = table.Column<int>(type: "int", nullable: false),
                    attendance_status = table.Column<string>(type: "enum('PRESENT','ABSENT','LATE','EXCUSED')", nullable: false),
                    remarks = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.attendance_id);
                    table.ForeignKey(
                        name: "fk_attendance_athlete",
                        column: x => x.athlete_id,
                        principalTable: "athlete_profiles",
                        principalColumn: "athlete_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_attendance_session",
                        column: x => x.training_session_id,
                        principalTable: "training_sessions",
                        principalColumn: "training_session_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "performance_records",
                columns: table => new
                {
                    performance_record_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    athlete_id = table.Column<int>(type: "int", nullable: false),
                    metric_id = table.Column<int>(type: "int", nullable: false),
                    recorded_value = table.Column<decimal>(type: "decimal(10,2)", precision: 10, nullable: false),
                    recorded_date = table.Column<DateTime>(type: "date", nullable: false),
                    coach_id = table.Column<int>(type: "int", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    data_type = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    unit = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    session_id = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.performance_record_id);
                    table.ForeignKey(
                        name: "fk_performance_athlete",
                        column: x => x.athlete_id,
                        principalTable: "athlete_profiles",
                        principalColumn: "athlete_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_performance_coach",
                        column: x => x.coach_id,
                        principalTable: "coach_profiles",
                        principalColumn: "coach_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_performance_metric",
                        column: x => x.metric_id,
                        principalTable: "performance_metric_definitions",
                        principalColumn: "metric_id");
                    table.ForeignKey(
                        name: "fk_performance_session",
                        column: x => x.session_id,
                        principalTable: "training_sessions",
                        principalColumn: "training_session_id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "fk_import_user",
                table: "academic_import_batches",
                column: "imported_by");

            migrationBuilder.CreateIndex(
                name: "fk_academic_athlete",
                table: "academic_records",
                column: "athlete_id");

            migrationBuilder.CreateIndex(
                name: "fk_academic_import_batch",
                table: "academic_records",
                column: "import_batch_id");

            migrationBuilder.CreateIndex(
                name: "fk_academic_term",
                table: "academic_records",
                column: "term_id");

            migrationBuilder.CreateIndex(
                name: "academic_year",
                table: "academic_terms",
                columns: new[] { "academic_year", "semester" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "fk_achievement_athlete",
                table: "achievements",
                column: "athlete_id");

            migrationBuilder.CreateIndex(
                name: "fk_achievement_verifier",
                table: "achievements",
                column: "verified_by");

            migrationBuilder.CreateIndex(
                name: "fk_announcement_creator",
                table: "announcements",
                column: "created_by");

            migrationBuilder.CreateIndex(
                name: "student_number",
                table: "athlete_profiles",
                column: "student_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "user_id",
                table: "athlete_profiles",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "fk_attendance_athlete",
                table: "attendance",
                column: "athlete_id");

            migrationBuilder.CreateIndex(
                name: "training_session_id",
                table: "attendance",
                columns: new[] { "training_session_id", "athlete_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "user_id1",
                table: "coach_profiles",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "fk_document_achievement",
                table: "documents",
                column: "achievement_id");

            migrationBuilder.CreateIndex(
                name: "fk_document_athlete",
                table: "documents",
                column: "athlete_id");

            migrationBuilder.CreateIndex(
                name: "athlete_id",
                table: "eligibility_records",
                columns: new[] { "athlete_id", "term_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "fk_eligibility_term",
                table: "eligibility_records",
                column: "term_id");

            migrationBuilder.CreateIndex(
                name: "fk_notification_user",
                table: "notifications",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "fk_metric_sport",
                table: "performance_metric_definitions",
                column: "sport_id");

            migrationBuilder.CreateIndex(
                name: "fk_performance_athlete",
                table: "performance_records",
                column: "athlete_id");

            migrationBuilder.CreateIndex(
                name: "fk_performance_coach",
                table: "performance_records",
                column: "coach_id");

            migrationBuilder.CreateIndex(
                name: "fk_performance_metric",
                table: "performance_records",
                column: "metric_id");

            migrationBuilder.CreateIndex(
                name: "IX_performance_records_session_id",
                table: "performance_records",
                column: "session_id");

            migrationBuilder.CreateIndex(
                name: "fk_portfolio_achievement",
                table: "portfolio_items",
                column: "achievement_id");

            migrationBuilder.CreateIndex(
                name: "fk_portfolio_athlete",
                table: "portfolio_items",
                column: "athlete_id");

            migrationBuilder.CreateIndex(
                name: "role_name",
                table: "roles",
                column: "role_name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "fk_schedule_creator",
                table: "schedules",
                column: "created_by");

            migrationBuilder.CreateIndex(
                name: "sport_name",
                table: "sports",
                column: "sport_name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "fk_member_athlete",
                table: "team_members",
                column: "athlete_id");

            migrationBuilder.CreateIndex(
                name: "team_id",
                table: "team_members",
                columns: new[] { "team_id", "athlete_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "fk_team_coach",
                table: "teams",
                column: "coach_id");

            migrationBuilder.CreateIndex(
                name: "fk_team_sport",
                table: "teams",
                column: "sport_id");

            migrationBuilder.CreateIndex(
                name: "fk_training_coach",
                table: "training_sessions",
                column: "coach_id");

            migrationBuilder.CreateIndex(
                name: "fk_training_team",
                table: "training_sessions",
                column: "team_id");

            migrationBuilder.CreateIndex(
                name: "email",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "fk_users_role",
                table: "users",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "university_id",
                table: "users",
                column: "university_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "academic_records");

            migrationBuilder.DropTable(
                name: "announcements");

            migrationBuilder.DropTable(
                name: "attendance");

            migrationBuilder.DropTable(
                name: "documents");

            migrationBuilder.DropTable(
                name: "eligibility_records");

            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "performance_records");

            migrationBuilder.DropTable(
                name: "portfolio_items");

            migrationBuilder.DropTable(
                name: "schedules");

            migrationBuilder.DropTable(
                name: "team_members");

            migrationBuilder.DropTable(
                name: "academic_import_batches");

            migrationBuilder.DropTable(
                name: "academic_terms");

            migrationBuilder.DropTable(
                name: "performance_metric_definitions");

            migrationBuilder.DropTable(
                name: "training_sessions");

            migrationBuilder.DropTable(
                name: "achievements");

            migrationBuilder.DropTable(
                name: "teams");

            migrationBuilder.DropTable(
                name: "athlete_profiles");

            migrationBuilder.DropTable(
                name: "coach_profiles");

            migrationBuilder.DropTable(
                name: "sports");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "roles");
        }
    }
}
