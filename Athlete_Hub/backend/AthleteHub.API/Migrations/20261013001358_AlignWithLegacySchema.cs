using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AthleteHub.API.Migrations
{
    /// <inheritdoc />
    public partial class AlignWithLegacySchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "schedule_type",
                table: "schedules",
                type: "enum('TRAINING','COMPETITION','ACADEMIC','MEETING','OTHER','SCHOOL_EVENT','SPORTS_EVENT')",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "enum('TRAINING','COMPETITION','ACADEMIC','MEETING','OTHER')");

            migrationBuilder.AlterColumn<string>(
                name: "semester",
                table: "academic_terms",
                type: "varchar(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(50)",
                oldMaxLength: 50);

            // The SQL-dump database refreshes updated_at on every change; databases created by migrations did not.
            migrationBuilder.Sql("ALTER TABLE `users` MODIFY `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "schedule_type",
                table: "schedules",
                type: "enum('TRAINING','COMPETITION','ACADEMIC','MEETING','OTHER')",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "enum('TRAINING','COMPETITION','ACADEMIC','MEETING','OTHER','SCHOOL_EVENT','SPORTS_EVENT')");

            migrationBuilder.AlterColumn<string>(
                name: "semester",
                table: "academic_terms",
                type: "varchar(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(100)",
                oldMaxLength: 100);
        }
    }
}
