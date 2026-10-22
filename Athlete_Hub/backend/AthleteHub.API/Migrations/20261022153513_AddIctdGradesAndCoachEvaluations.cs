using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace AthleteHub.API.Migrations
{
    /// <inheritdoc />
    public partial class AddIctdGradesAndCoachEvaluations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "section_code",
                table: "academic_records",
                type: "varchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "coach_evaluations",
                columns: table => new
                {
                    coach_evaluation_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    athlete_id = table.Column<int>(type: "int", nullable: false),
                    coach_id = table.Column<int>(type: "int", nullable: false),
                    term_id = table.Column<int>(type: "int", nullable: false),
                    team_id = table.Column<int>(type: "int", nullable: true),
                    status = table.Column<string>(type: "enum('PENDING','SUBMITTED')", nullable: false, defaultValueSql: "'PENDING'"),
                    ratings = table.Column<string>(type: "text", nullable: true),
                    comments = table.Column<string>(type: "text", nullable: true),
                    sent_at = table.Column<DateTime>(type: "timestamp", nullable: true),
                    submitted_at = table.Column<DateTime>(type: "timestamp", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.coach_evaluation_id);
                    table.ForeignKey(
                        name: "fk_coach_evaluation_athlete",
                        column: x => x.athlete_id,
                        principalTable: "athlete_profiles",
                        principalColumn: "athlete_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_coach_evaluation_coach",
                        column: x => x.coach_id,
                        principalTable: "coach_profiles",
                        principalColumn: "coach_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_coach_evaluation_team",
                        column: x => x.team_id,
                        principalTable: "teams",
                        principalColumn: "team_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_coach_evaluation_term",
                        column: x => x.term_id,
                        principalTable: "academic_terms",
                        principalColumn: "term_id");
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "coach_evaluation_unique",
                table: "coach_evaluations",
                columns: new[] { "athlete_id", "coach_id", "term_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "fk_coach_evaluation_coach",
                table: "coach_evaluations",
                column: "coach_id");

            migrationBuilder.CreateIndex(
                name: "fk_coach_evaluation_team",
                table: "coach_evaluations",
                column: "team_id");

            migrationBuilder.CreateIndex(
                name: "fk_coach_evaluation_term",
                table: "coach_evaluations",
                column: "term_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "coach_evaluations");

            migrationBuilder.DropColumn(
                name: "section_code",
                table: "academic_records");
        }
    }
}
