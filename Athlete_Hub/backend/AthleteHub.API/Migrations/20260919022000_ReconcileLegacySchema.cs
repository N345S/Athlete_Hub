using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AthleteHub.API.Migrations;

public partial class ReconcileLegacySchema : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "achievement_id",
            table: "documents",
            type: "int",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "title",
            table: "documents",
            type: "varchar(200)",
            maxLength: 200,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "description",
            table: "documents",
            type: "text",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "fk_document_achievement",
            table: "documents",
            column: "achievement_id");

        migrationBuilder.AddForeignKey(
            name: "fk_document_achievement",
            table: "documents",
            column: "achievement_id",
            principalTable: "achievements",
            principalColumn: "achievement_id",
            onDelete: ReferentialAction.SetNull);

        migrationBuilder.AddColumn<string>(
            name: "approval_status",
            table: "training_sessions",
            type: "varchar(20)",
            maxLength: 20,
            nullable: false,
            defaultValue: "APPROVED");

        migrationBuilder.AddColumn<DateTime>(
            name: "submitted_at",
            table: "training_sessions",
            type: "timestamp",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "reviewed_at",
            table: "training_sessions",
            type: "timestamp",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "reviewed_by",
            table: "training_sessions",
            type: "int",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "rejection_reason",
            table: "training_sessions",
            type: "text",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "fk_document_achievement",
            table: "documents");

        migrationBuilder.DropIndex(
            name: "fk_document_achievement",
            table: "documents");

        migrationBuilder.DropColumn(name: "achievement_id", table: "documents");
        migrationBuilder.DropColumn(name: "title", table: "documents");
        migrationBuilder.DropColumn(name: "description", table: "documents");
        migrationBuilder.DropColumn(name: "approval_status", table: "training_sessions");
        migrationBuilder.DropColumn(name: "submitted_at", table: "training_sessions");
        migrationBuilder.DropColumn(name: "reviewed_at", table: "training_sessions");
        migrationBuilder.DropColumn(name: "reviewed_by", table: "training_sessions");
        migrationBuilder.DropColumn(name: "rejection_reason", table: "training_sessions");
    }
}