using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using AthleteHub.API.Data;

#nullable disable

namespace AthleteHub.API.Migrations;

[DbContext(typeof(AthleteHubDbContext))]
[Migration("20260919023000_RepairAchievementRejectionReason")]
public partial class RepairAchievementRejectionReason : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            "ALTER TABLE `achievements` ADD COLUMN `rejection_reason` TEXT NULL AFTER `verified_at`;" );
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            "ALTER TABLE `achievements` DROP COLUMN `rejection_reason`;" );
    }
}
