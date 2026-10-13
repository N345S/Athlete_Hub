using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using AthleteHub.API.Data;

#nullable disable

namespace AthleteHub.API.Migrations;

[DbContext(typeof(AthleteHubDbContext))]
[Migration("20260921120000_RepairPerformanceRecordSchema")]
public partial class RepairPerformanceRecordSchema : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // A database created from scratch already has this column from InitialAthleteHubSchema.
        migrationBuilder.AddColumnIfMissing("performance_records", "unit", "varchar(30) NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "fk_performance_session",
            table: "performance_records");

        migrationBuilder.DropIndex(
            name: "IX_performance_records_session_id",
            table: "performance_records");

        migrationBuilder.DropColumn(name: "unit", table: "performance_records");
    }
}
