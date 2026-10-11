using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace AthleteHub.API.Migrations
{
    /// <inheritdoc />
    public partial class AddParentRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Parents monitor their own children's training sessions only.
            migrationBuilder.Sql("INSERT IGNORE INTO roles (role_name, description) VALUES ('PARENT', 'Parent or guardian who monitors their child''s training sessions');");

            migrationBuilder.CreateTable(
                name: "parent_athletes",
                columns: table => new
                {
                    parent_athlete_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    parent_user_id = table.Column<int>(type: "int", nullable: false),
                    athlete_id = table.Column<int>(type: "int", nullable: false),
                    relationship = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp", nullable: true, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.parent_athlete_id);
                    table.ForeignKey(
                        name: "fk_parent_athlete_athlete",
                        column: x => x.athlete_id,
                        principalTable: "athlete_profiles",
                        principalColumn: "athlete_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_parent_athlete_parent",
                        column: x => x.parent_user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "fk_parent_athlete_athlete",
                table: "parent_athletes",
                column: "athlete_id");

            migrationBuilder.CreateIndex(
                name: "parent_athlete_unique",
                table: "parent_athletes",
                columns: new[] { "parent_user_id", "athlete_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "parent_athletes");

            migrationBuilder.Sql("DELETE FROM roles WHERE role_name = 'PARENT' AND NOT EXISTS (SELECT 1 FROM users WHERE users.role_id = roles.role_id);");
        }
    }
}
