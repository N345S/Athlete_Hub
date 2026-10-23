using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AthleteHub.API.Migrations
{
    /// <inheritdoc />
    public partial class AddScheduleCancelAndReschedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "cancellation_reason",
                table: "training_sessions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "cancelled_at",
                table: "training_sessions",
                type: "timestamp",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "reschedule_reason",
                table: "training_sessions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "rescheduled_at",
                table: "training_sessions",
                type: "timestamp",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cancellation_reason",
                table: "schedules",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "cancelled_at",
                table: "schedules",
                type: "timestamp",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "reschedule_reason",
                table: "schedules",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "rescheduled_at",
                table: "schedules",
                type: "timestamp",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "cancellation_reason",
                table: "training_sessions");

            migrationBuilder.DropColumn(
                name: "cancelled_at",
                table: "training_sessions");

            migrationBuilder.DropColumn(
                name: "reschedule_reason",
                table: "training_sessions");

            migrationBuilder.DropColumn(
                name: "rescheduled_at",
                table: "training_sessions");

            migrationBuilder.DropColumn(
                name: "cancellation_reason",
                table: "schedules");

            migrationBuilder.DropColumn(
                name: "cancelled_at",
                table: "schedules");

            migrationBuilder.DropColumn(
                name: "reschedule_reason",
                table: "schedules");

            migrationBuilder.DropColumn(
                name: "rescheduled_at",
                table: "schedules");
        }
    }
}
