using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AthleteHub.API.Migrations;

public partial class ReconcileLegacySchema : Migration
{
    // Brings databases created from the old SQL dump up to date. A database created from scratch already has
    // all of this from InitialAthleteHubSchema, so each step is skipped when it is already there.
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumnIfMissing("documents", "achievement_id", "int NULL");
        migrationBuilder.AddColumnIfMissing("documents", "title", "varchar(200) NULL");
        migrationBuilder.AddColumnIfMissing("documents", "description", "text NULL");
        migrationBuilder.CreateIndexIfMissing("documents", "fk_document_achievement", "achievement_id");
        migrationBuilder.AddForeignKeyIfMissing("documents", "fk_document_achievement",
            "FOREIGN KEY (`achievement_id`) REFERENCES `achievements` (`achievement_id`) ON DELETE SET NULL");

        migrationBuilder.AddColumnIfMissing("training_sessions", "approval_status", "varchar(20) NOT NULL DEFAULT 'APPROVED'");
        migrationBuilder.AddColumnIfMissing("training_sessions", "submitted_at", "timestamp NULL");
        migrationBuilder.AddColumnIfMissing("training_sessions", "reviewed_at", "timestamp NULL");
        migrationBuilder.AddColumnIfMissing("training_sessions", "reviewed_by", "int NULL");
        migrationBuilder.AddColumnIfMissing("training_sessions", "rejection_reason", "text NULL");
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
