ALTER TABLE documents
    ADD COLUMN achievement_id INT NULL AFTER athlete_id,
    ADD INDEX fk_document_achievement (achievement_id),
    ADD CONSTRAINT fk_document_achievement
        FOREIGN KEY (achievement_id)
        REFERENCES achievements(achievement_id)
        ON DELETE SET NULL;
