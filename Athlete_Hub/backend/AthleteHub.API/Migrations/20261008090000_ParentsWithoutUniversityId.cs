using AthleteHub.API.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AthleteHub.API.Migrations;

/// <summary>
/// Parents have no university ID; they are correlated to athletes through parent_athletes.
/// MySQL unique indexes allow many NULLs, so the existing university_id index still applies to everyone else.
/// </summary>
[DbContext(typeof(AthleteHubDbContext))]
[Migration("20261008090000_ParentsWithoutUniversityId")]
public partial class ParentsWithoutUniversityId : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<string>(
            name: "university_id",
            table: "users",
            type: "varchar(50)",
            maxLength: 50,
            nullable: true,
            oldClrType: typeof(string),
            oldType: "varchar(50)",
            oldMaxLength: 50);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Give any parent without an ID a placeholder so the column can become NOT NULL again.
        migrationBuilder.Sql("UPDATE users SET university_id = CONCAT('PARENT-', user_id) WHERE university_id IS NULL;");

        migrationBuilder.AlterColumn<string>(
            name: "university_id",
            table: "users",
            type: "varchar(50)",
            maxLength: 50,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "varchar(50)",
            oldMaxLength: 50,
            oldNullable: true);
    }
}
