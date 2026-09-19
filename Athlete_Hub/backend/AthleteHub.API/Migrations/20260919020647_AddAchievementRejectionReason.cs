using AthleteHub.API.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AthleteHub.API.Migrations;

[DbContext(typeof(AthleteHubDbContext))]
[Migration("20260919020647_AddAchievementRejectionReason")]
public partial class AddAchievementRejectionReason : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
