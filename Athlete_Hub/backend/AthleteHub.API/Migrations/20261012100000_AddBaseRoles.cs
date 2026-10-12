using AthleteHub.API.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AthleteHub.API.Migrations;

/// <summary>
/// The base roles used to come only from the SQL dump in database/Database_data, so a database created
/// purely by migrations (e.g. a fresh cloud deployment) had no roles. role_name is unique, so existing rows are kept.
/// </summary>
[DbContext(typeof(AthleteHubDbContext))]
[Migration("20261012100000_AddBaseRoles")]
public partial class AddBaseRoles : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            INSERT IGNORE INTO roles (role_name, description) VALUES
            ('ATHLETE', 'Student-athlete user'),
            ('COACH', 'Coach responsible for athlete and team monitoring'),
            ('DIRECTOR', 'Sports Director responsible for administration and monitoring'),
            ('ADMIN', 'Manages user accounts, roles, account status, and system access'),
            ('REGISTRAR', 'Evaluates academic records and academic eligibility');
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Roles may already be referenced by users, so they are left in place.
    }
}
