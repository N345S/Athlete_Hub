using Microsoft.EntityFrameworkCore.Migrations;

namespace AthleteHub.API.Migrations;

/// <summary>
/// Schema steps that only run when the column, index, or foreign key is missing. Some migrations repaired
/// databases created from the old SQL dump; on a database created from scratch, InitialAthleteHubSchema already
/// contains those changes, so running them unconditionally fails with "duplicate column".
/// MySQL has no ADD COLUMN IF NOT EXISTS, so each step runs inside a short-lived stored procedure.
/// </summary>
internal static class SchemaGuards
{
    private const string Procedure = "athletehub_schema_guard";

    public static void AddColumnIfMissing(this MigrationBuilder migrationBuilder, string table, string column, string definition) =>
        migrationBuilder.RunIf(
            $"NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{table}' AND COLUMN_NAME = '{column}')",
            $"ALTER TABLE `{table}` ADD `{column}` {definition}");

    public static void CreateIndexIfMissing(this MigrationBuilder migrationBuilder, string table, string index, string column) =>
        migrationBuilder.RunIf(
            $"NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{table}' AND INDEX_NAME = '{index}')",
            $"CREATE INDEX `{index}` ON `{table}` (`{column}`)");

    public static void AddForeignKeyIfMissing(this MigrationBuilder migrationBuilder, string table, string name, string definition) =>
        migrationBuilder.RunIf(
            $"NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{table}' AND CONSTRAINT_NAME = '{name}' AND CONSTRAINT_TYPE = 'FOREIGN KEY')",
            $"ALTER TABLE `{table}` ADD CONSTRAINT `{name}` {definition}");

    private static void RunIf(this MigrationBuilder migrationBuilder, string condition, string statement)
    {
        migrationBuilder.Sql($"DROP PROCEDURE IF EXISTS {Procedure}");
        migrationBuilder.Sql($"CREATE PROCEDURE {Procedure}() BEGIN IF {condition} THEN {statement}; END IF; END");
        migrationBuilder.Sql($"CALL {Procedure}()");
        migrationBuilder.Sql($"DROP PROCEDURE {Procedure}");
    }
}
