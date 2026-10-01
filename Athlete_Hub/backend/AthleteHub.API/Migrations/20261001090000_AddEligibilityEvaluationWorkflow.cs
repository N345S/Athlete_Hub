using AthleteHub.API.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AthleteHub.API.Migrations;

[DbContext(typeof(AthleteHubDbContext))]
[Migration("20261001090000_AddEligibilityEvaluationWorkflow")]
public partial class AddEligibilityEvaluationWorkflow : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "document_id",
            table: "eligibility_records",
            type: "int",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "eligibility_reasons",
            table: "eligibility_records",
            type: "longtext",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "requested_at",
            table: "eligibility_records",
            type: "timestamp",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "requested_by",
            table: "eligibility_records",
            type: "int",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "reviewed_at",
            table: "eligibility_records",
            type: "timestamp",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "reviewed_by",
            table: "eligibility_records",
            type: "int",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "uploaded_by",
            table: "eligibility_records",
            type: "int",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "fk_eligibility_document",
            table: "eligibility_records",
            column: "document_id");

        migrationBuilder.CreateIndex(
            name: "fk_eligibility_requested_by",
            table: "eligibility_records",
            column: "requested_by");

        migrationBuilder.CreateIndex(
            name: "fk_eligibility_reviewed_by",
            table: "eligibility_records",
            column: "reviewed_by");

        migrationBuilder.CreateIndex(
            name: "fk_eligibility_uploaded_by",
            table: "eligibility_records",
            column: "uploaded_by");

        migrationBuilder.AddForeignKey(
            name: "fk_eligibility_document",
            table: "eligibility_records",
            column: "document_id",
            principalTable: "documents",
            principalColumn: "document_id",
            onDelete: ReferentialAction.SetNull);

        migrationBuilder.AddForeignKey(
            name: "fk_eligibility_requested_by",
            table: "eligibility_records",
            column: "requested_by",
            principalTable: "users",
            principalColumn: "user_id",
            onDelete: ReferentialAction.SetNull);

        migrationBuilder.AddForeignKey(
            name: "fk_eligibility_reviewed_by",
            table: "eligibility_records",
            column: "reviewed_by",
            principalTable: "users",
            principalColumn: "user_id",
            onDelete: ReferentialAction.SetNull);

        migrationBuilder.AddForeignKey(
            name: "fk_eligibility_uploaded_by",
            table: "eligibility_records",
            column: "uploaded_by",
            principalTable: "users",
            principalColumn: "user_id",
            onDelete: ReferentialAction.SetNull);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(name: "fk_eligibility_document", table: "eligibility_records");
        migrationBuilder.DropForeignKey(name: "fk_eligibility_requested_by", table: "eligibility_records");
        migrationBuilder.DropForeignKey(name: "fk_eligibility_reviewed_by", table: "eligibility_records");
        migrationBuilder.DropForeignKey(name: "fk_eligibility_uploaded_by", table: "eligibility_records");

        migrationBuilder.DropIndex(name: "fk_eligibility_document", table: "eligibility_records");
        migrationBuilder.DropIndex(name: "fk_eligibility_requested_by", table: "eligibility_records");
        migrationBuilder.DropIndex(name: "fk_eligibility_reviewed_by", table: "eligibility_records");
        migrationBuilder.DropIndex(name: "fk_eligibility_uploaded_by", table: "eligibility_records");

        migrationBuilder.DropColumn(name: "document_id", table: "eligibility_records");
        migrationBuilder.DropColumn(name: "eligibility_reasons", table: "eligibility_records");
        migrationBuilder.DropColumn(name: "requested_at", table: "eligibility_records");
        migrationBuilder.DropColumn(name: "requested_by", table: "eligibility_records");
        migrationBuilder.DropColumn(name: "reviewed_at", table: "eligibility_records");
        migrationBuilder.DropColumn(name: "reviewed_by", table: "eligibility_records");
        migrationBuilder.DropColumn(name: "uploaded_by", table: "eligibility_records");
    }
}