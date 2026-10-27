using AthleteHub.API.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AthleteHub.API.Migrations;

/// <summary>The ICTD grades office role (see Services/IctdOffice.cs). role_name is unique, so a rerun keeps the row.</summary>
[DbContext(typeof(AthleteHubDbContext))]
[Migration("20261027130000_AddIctdOfficeRole")]
public partial class AddIctdOfficeRole : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            INSERT IGNORE INTO roles (role_name, description) VALUES
            ('ICTD', 'ICTD grades office: releases final grades (used to test the end of a term)');
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // The role may already be referenced by the office account, so it is left in place.
    }
}
