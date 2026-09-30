-- Migration: Add DataType and SessionId columns to PerformanceRecords
-- Date: 2026-09-18
-- Description: Add universal performance tracking support
-- Assumes table names: performance_records, performance_metric_definitions, training_sessions
-- Adjust table names below if your schema uses different prefixes (e.g., athlete_hub_)

-- 1. Add DataType column to performance_records table
ALTER TABLE `performance_records`
ADD COLUMN `data_type` VARCHAR(50) NULL COMMENT 'Coach-defined metric type (e.g., PUSH_UP, BALANCE, SPRINT)' AFTER `notes`;

-- 2. Add SessionId column to performance_records table
ALTER TABLE `performance_records`
ADD COLUMN `session_id` INT NULL COMMENT 'FK to training_sessions' AFTER `data_type`;

-- 3. Add foreign key constraint for SessionId
ALTER TABLE `performance_records`
ADD CONSTRAINT `fk_performance_session`
FOREIGN KEY (`session_id`) REFERENCES `training_sessions`(`training_session_id`)
ON DELETE SET NULL;

-- 4. Add DataType column to performance_metric_definitions table
ALTER TABLE `performance_metric_definitions`
ADD COLUMN `data_type` VARCHAR(50) NULL COMMENT 'Coach-defined metric type (e.g., PUSH_UP, BALANCE, SPRINT)' AFTER `unit`;

-- 5. Insert universal metric definitions with coach-defined DataTypes
-- Uses first available sport_id from sports table (separate statements for MySQL compatibility)
INSERT IGNORE INTO `performance_metric_definitions` (`metric_name`, `unit`, `data_type`, `sport_id`, `description`)
SELECT 'AthleticPerformance', 'count', 'PUSH_UP', s.sport_id, 'Universal metric for tracking push-up counts per session'
FROM `sports` s LIMIT 1;

INSERT IGNORE INTO `performance_metric_definitions` (`metric_name`, `unit`, `data_type`, `sport_id`, `description`)
SELECT 'AthleticPerformance', 'seconds', 'BALANCE', s.sport_id, 'Universal metric for tracking balance duration per session'
FROM `sports` s LIMIT 1;

INSERT IGNORE INTO `performance_metric_definitions` (`metric_name`, `unit`, `data_type`, `sport_id`, `description`)
SELECT 'AthleticPerformance', 'seconds', 'SPRINT_10M', s.sport_id, 'Universal metric for tracking 10-meter sprint time per session'
FROM `sports` s LIMIT 1;

INSERT IGNORE INTO `performance_metric_definitions` (`metric_name`, `unit`, `data_type`, `sport_id`, `description`)
SELECT 'AthleticPerformance', 'seconds', 'SPRINT_40M', s.sport_id, 'Universal metric for tracking 40-meter sprint time per session'
FROM `sports` s LIMIT 1;

INSERT IGNORE INTO `performance_metric_definitions` (`metric_name`, `unit`, `data_type`, `sport_id`, `description`)
SELECT 'AthleticPerformance', 'count', 'VELOCITY', s.sport_id, 'Universal metric for tracking velocity measurements per session'
FROM `sports` s LIMIT 1;

-- 6. Create index for faster queries on data_type and session_id
CREATE INDEX `idx_performance_data_type` ON `performance_records` (`data_type`);
CREATE INDEX `idx_performance_session_id` ON `performance_records` (`session_id`);