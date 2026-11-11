using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace AthleteHub.API.Migrations
{
    /// <inheritdoc />
    public partial class AddEligibilityLineupsAndDocumentTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "lineup_max_age",
                table: "schedules",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "lineup_max_players",
                table: "schedules",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "lineup_max_year_level",
                table: "schedules",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "lineup_min_players",
                table: "schedules",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "lineup_required_documents",
                table: "schedules",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "lineup_sport_id",
                table: "schedules",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "eligibility_checked_at",
                table: "athlete_profiles",
                type: "timestamp",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "eligibility_reasons",
                table: "athlete_profiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "eligibility_status",
                table: "athlete_profiles",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "document_types",
                columns: table => new
                {
                    document_type_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    required_for_eligibility = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp", nullable: true, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.document_type_id);
                    table.ForeignKey(
                        name: "fk_document_type_creator",
                        column: x => x.created_by,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "event_lineups",
                columns: table => new
                {
                    lineup_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    schedule_id = table.Column<int>(type: "int", nullable: false),
                    team_id = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<string>(type: "enum('PENDING','APPROVED','REJECTED')", nullable: false, defaultValueSql: "'PENDING'"),
                    notes = table.Column<string>(type: "text", nullable: true),
                    submitted_by = table.Column<int>(type: "int", nullable: true),
                    submitted_at = table.Column<DateTime>(type: "timestamp", nullable: true),
                    reviewed_by = table.Column<int>(type: "int", nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "timestamp", nullable: true),
                    review_note = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.lineup_id);
                    table.ForeignKey(
                        name: "fk_event_lineup_schedule",
                        column: x => x.schedule_id,
                        principalTable: "schedules",
                        principalColumn: "schedule_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_lineup_team",
                        column: x => x.team_id,
                        principalTable: "teams",
                        principalColumn: "team_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "event_lineup_players",
                columns: table => new
                {
                    lineup_player_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    lineup_id = table.Column<int>(type: "int", nullable: false),
                    athlete_id = table.Column<int>(type: "int", nullable: false),
                    position = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.lineup_player_id);
                    table.ForeignKey(
                        name: "fk_event_lineup_player_athlete",
                        column: x => x.athlete_id,
                        principalTable: "athlete_profiles",
                        principalColumn: "athlete_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_lineup_player_lineup",
                        column: x => x.lineup_id,
                        principalTable: "event_lineups",
                        principalColumn: "lineup_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "fk_schedule_lineup_sport",
                table: "schedules",
                column: "lineup_sport_id");

            migrationBuilder.CreateIndex(
                name: "document_type_name",
                table: "document_types",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "fk_document_type_creator",
                table: "document_types",
                column: "created_by");

            migrationBuilder.CreateIndex(
                name: "event_lineup_player_unique",
                table: "event_lineup_players",
                columns: new[] { "lineup_id", "athlete_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "fk_event_lineup_player_athlete",
                table: "event_lineup_players",
                column: "athlete_id");

            migrationBuilder.CreateIndex(
                name: "event_lineup_unique",
                table: "event_lineups",
                columns: new[] { "schedule_id", "team_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "fk_event_lineup_team",
                table: "event_lineups",
                column: "team_id");

            migrationBuilder.AddForeignKey(
                name: "fk_schedule_lineup_sport",
                table: "schedules",
                column: "lineup_sport_id",
                principalTable: "sports",
                principalColumn: "sport_id",
                onDelete: ReferentialAction.SetNull);

            // The upload choices that existed before types could be added, plus any type already used by an upload.
            // Medical Clearance starts as the one clearance every athlete must have on file.
            migrationBuilder.Sql("""
                INSERT IGNORE INTO document_types (name, required_for_eligibility, created_at) VALUES
                ('Medical Clearance', 1, CURRENT_TIMESTAMP),
                ('Consent Form', 0, CURRENT_TIMESTAMP),
                ('Enrollment Form', 0, CURRENT_TIMESTAMP),
                ('Athletic Eligibility Form', 0, CURRENT_TIMESTAMP),
                ('PSA Birth Certificate', 0, CURRENT_TIMESTAMP),
                ('Other', 0, CURRENT_TIMESTAMP);
                """);
            migrationBuilder.Sql("""
                INSERT IGNORE INTO document_types (name, required_for_eligibility, created_at)
                SELECT DISTINCT TRIM(document_type), 0, CURRENT_TIMESTAMP FROM documents
                WHERE document_type NOT IN ('GRADE_EVALUATION', 'Achievement Evidence') AND TRIM(document_type) <> '';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_schedule_lineup_sport",
                table: "schedules");

            migrationBuilder.DropTable(
                name: "document_types");

            migrationBuilder.DropTable(
                name: "event_lineup_players");

            migrationBuilder.DropTable(
                name: "event_lineups");

            migrationBuilder.DropIndex(
                name: "fk_schedule_lineup_sport",
                table: "schedules");

            migrationBuilder.DropColumn(
                name: "lineup_max_age",
                table: "schedules");

            migrationBuilder.DropColumn(
                name: "lineup_max_players",
                table: "schedules");

            migrationBuilder.DropColumn(
                name: "lineup_max_year_level",
                table: "schedules");

            migrationBuilder.DropColumn(
                name: "lineup_min_players",
                table: "schedules");

            migrationBuilder.DropColumn(
                name: "lineup_required_documents",
                table: "schedules");

            migrationBuilder.DropColumn(
                name: "lineup_sport_id",
                table: "schedules");

            migrationBuilder.DropColumn(
                name: "eligibility_checked_at",
                table: "athlete_profiles");

            migrationBuilder.DropColumn(
                name: "eligibility_reasons",
                table: "athlete_profiles");

            migrationBuilder.DropColumn(
                name: "eligibility_status",
                table: "athlete_profiles");
        }
    }
}
