-- ============================================================
-- 1. CREATE DATABASE
-- ============================================================

CREATE DATABASE IF NOT EXISTS athlete_hub
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE athlete_hub;


-- ============================================================
-- 2. ROLES
-- ============================================================

CREATE TABLE roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,

    role_name VARCHAR(50) NOT NULL UNIQUE,

    description VARCHAR(255)
);


-- ============================================================
-- 3. USERS
-- ============================================================

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,

    role_id INT NOT NULL,

    university_id VARCHAR(50) NOT NULL UNIQUE,

    email VARCHAR(150) NOT NULL UNIQUE,

    password_hash VARCHAR(255) NOT NULL,

    first_name VARCHAR(100) NOT NULL,

    middle_name VARCHAR(100),

    last_name VARCHAR(100) NOT NULL,

    phone VARCHAR(30),

    account_status ENUM(
        'ACTIVE',
        'INACTIVE',
        'SUSPENDED'
    ) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id)
        REFERENCES roles(role_id)
);


-- ============================================================
-- 4. ATHLETE PROFILES
-- ============================================================

CREATE TABLE athlete_profiles (
    athlete_id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL UNIQUE,

    student_number VARCHAR(50) NOT NULL UNIQUE,

    course VARCHAR(150),

    year_level INT,

    birth_date DATE,

    profile_photo_url VARCHAR(500),

    CONSTRAINT fk_athlete_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);


-- ============================================================
-- 5. COACH PROFILES
-- ============================================================

CREATE TABLE coach_profiles (
    coach_id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL UNIQUE,

    specialization VARCHAR(150),

    CONSTRAINT fk_coach_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);


-- ============================================================
-- 6. SPORTS
-- ============================================================

CREATE TABLE sports (
    sport_id INT AUTO_INCREMENT PRIMARY KEY,

    sport_name VARCHAR(100) NOT NULL UNIQUE,

    description TEXT,

    sport_type ENUM(
        'INDIVIDUAL',
        'TEAM'
    ) NOT NULL
);


-- ============================================================
-- 7. TEAMS
-- ============================================================

CREATE TABLE teams (
    team_id INT AUTO_INCREMENT PRIMARY KEY,

    sport_id INT NOT NULL,

    coach_id INT,

    team_name VARCHAR(100) NOT NULL,

    school_year VARCHAR(20),

    status ENUM(
        'ACTIVE',
        'INACTIVE'
    ) NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT fk_team_sport
        FOREIGN KEY (sport_id)
        REFERENCES sports(sport_id),

    CONSTRAINT fk_team_coach
        FOREIGN KEY (coach_id)
        REFERENCES coach_profiles(coach_id)
        ON DELETE SET NULL
);


-- ============================================================
-- 8. TEAM MEMBERS
-- ============================================================

CREATE TABLE team_members (
    team_member_id INT AUTO_INCREMENT PRIMARY KEY,

    team_id INT NOT NULL,

    athlete_id INT NOT NULL,

    achievement_id INT,

    date_joined DATE,

    date_left DATE,

    CONSTRAINT fk_member_team
        FOREIGN KEY (team_id)
        REFERENCES teams(team_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_member_athlete
        FOREIGN KEY (athlete_id)
        REFERENCES athlete_profiles(athlete_id)
        ON DELETE CASCADE,

    UNIQUE (team_id, athlete_id)
);


-- ============================================================
-- 9. ACADEMIC TERMS
-- ============================================================

CREATE TABLE academic_terms (
    term_id INT AUTO_INCREMENT PRIMARY KEY,

    academic_year VARCHAR(20) NOT NULL,

    semester VARCHAR(50) NOT NULL,

    start_date DATE,

    end_date DATE,

    UNIQUE (
        academic_year,
        semester
    )
);


-- ============================================================
-- 10. ACADEMIC IMPORT BATCHES
-- ============================================================

CREATE TABLE academic_import_batches (
    import_batch_id INT AUTO_INCREMENT PRIMARY KEY,

    source_system VARCHAR(150) NOT NULL,

    import_method ENUM(
        'API',
        'FILE_IMPORT',
        'MANUAL'
    ) NOT NULL,

    file_name VARCHAR(255),

    imported_by INT,

    import_status ENUM(
        'PENDING',
        'COMPLETED',
        'FAILED'
    ) NOT NULL DEFAULT 'PENDING',

    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_import_user
        FOREIGN KEY (imported_by)
        REFERENCES users(user_id)
        ON DELETE SET NULL
);


-- ============================================================
-- 11. ACADEMIC RECORDS
-- ============================================================

CREATE TABLE academic_records (
    academic_record_id INT AUTO_INCREMENT PRIMARY KEY,

    athlete_id INT NOT NULL,

    term_id INT NOT NULL,

    import_batch_id INT,

    subject_code VARCHAR(50) NOT NULL,

    subject_name VARCHAR(150) NOT NULL,

    units DECIMAL(4,2),

    grade DECIMAL(4,2),

    remarks VARCHAR(100),

    source_type ENUM(
        'API',
        'FILE_IMPORT',
        'MANUAL'
    ) NOT NULL DEFAULT 'FILE_IMPORT',

    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_academic_athlete
        FOREIGN KEY (athlete_id)
        REFERENCES athlete_profiles(athlete_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_academic_term
        FOREIGN KEY (term_id)
        REFERENCES academic_terms(term_id),

    CONSTRAINT fk_academic_import_batch
        FOREIGN KEY (import_batch_id)
        REFERENCES academic_import_batches(import_batch_id)
        ON DELETE SET NULL
);


-- ============================================================
-- 12. ELIGIBILITY RECORDS
-- ============================================================

CREATE TABLE eligibility_records (
    eligibility_id INT AUTO_INCREMENT PRIMARY KEY,

    athlete_id INT NOT NULL,

    term_id INT NOT NULL,

    academic_status ENUM(
        'ELIGIBLE',
        'AT_RISK',
        'INELIGIBLE',
        'PENDING'
    ) NOT NULL DEFAULT 'PENDING',

    remarks TEXT,

    evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_eligibility_athlete
        FOREIGN KEY (athlete_id)
        REFERENCES athlete_profiles(athlete_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_eligibility_term
        FOREIGN KEY (term_id)
        REFERENCES academic_terms(term_id),

    UNIQUE (
        athlete_id,
        term_id
    )
);


-- ============================================================
-- 13. ACHIEVEMENTS
-- ============================================================

CREATE TABLE achievements (
    achievement_id INT AUTO_INCREMENT PRIMARY KEY,

    athlete_id INT NOT NULL,

    title VARCHAR(200) NOT NULL,

    description TEXT,

    achievement_date DATE,

    category VARCHAR(100),

    verification_status ENUM(
        'PENDING',
        'VERIFIED',
        'REJECTED'
    ) NOT NULL DEFAULT 'PENDING',

    verified_by INT,

    verified_at TIMESTAMP NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_achievement_athlete
        FOREIGN KEY (athlete_id)
        REFERENCES athlete_profiles(athlete_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_achievement_verifier
        FOREIGN KEY (verified_by)
        REFERENCES users(user_id)
        ON DELETE SET NULL
);


-- ============================================================
-- 14. DOCUMENTS
-- ============================================================

CREATE TABLE documents (
    document_id INT AUTO_INCREMENT PRIMARY KEY,

    athlete_id INT NOT NULL,

    document_type VARCHAR(100) NOT NULL,

    document_name VARCHAR(255) NOT NULL,

    file_url VARCHAR(500) NOT NULL,

    status ENUM(
        'PENDING',
        'APPROVED',
        'REJECTED'
    ) NOT NULL DEFAULT 'PENDING',

    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_document_athlete
        FOREIGN KEY (athlete_id)
        REFERENCES athlete_profiles(athlete_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_document_achievement
        FOREIGN KEY (achievement_id)
        REFERENCES achievements(achievement_id)
        ON DELETE SET NULL
);


-- ============================================================
-- 15. PORTFOLIO ITEMS
-- ============================================================

CREATE TABLE portfolio_items (
    portfolio_item_id INT AUTO_INCREMENT PRIMARY KEY,

    athlete_id INT NOT NULL,

    achievement_id INT,

    title VARCHAR(200) NOT NULL,

    description TEXT,

    display_order INT DEFAULT 0,

    is_visible BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_portfolio_athlete
        FOREIGN KEY (athlete_id)
        REFERENCES athlete_profiles(athlete_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_portfolio_achievement
        FOREIGN KEY (achievement_id)
        REFERENCES achievements(achievement_id)
        ON DELETE SET NULL
);


-- ============================================================
-- 16. TRAINING SESSIONS
-- ============================================================

CREATE TABLE training_sessions (
    training_session_id INT AUTO_INCREMENT PRIMARY KEY,

    team_id INT NOT NULL,

    coach_id INT NOT NULL,

    title VARCHAR(200) NOT NULL,

    description TEXT,

    training_date DATE NOT NULL,

    start_time TIME,

    end_time TIME,

    location VARCHAR(200),

    CONSTRAINT fk_training_team
        FOREIGN KEY (team_id)
        REFERENCES teams(team_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_training_coach
        FOREIGN KEY (coach_id)
        REFERENCES coach_profiles(coach_id)
);


-- ============================================================
-- 17. ATTENDANCE
-- ============================================================

CREATE TABLE attendance (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,

    training_session_id INT NOT NULL,

    athlete_id INT NOT NULL,

    attendance_status ENUM(
        'PRESENT',
        'ABSENT',
        'LATE',
        'EXCUSED'
    ) NOT NULL,

    remarks VARCHAR(255),

    CONSTRAINT fk_attendance_session
        FOREIGN KEY (training_session_id)
        REFERENCES training_sessions(training_session_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_attendance_athlete
        FOREIGN KEY (athlete_id)
        REFERENCES athlete_profiles(athlete_id)
        ON DELETE CASCADE,

    UNIQUE (
        training_session_id,
        athlete_id
    )
);


-- ============================================================
-- 18. PERFORMANCE METRIC DEFINITIONS
-- ============================================================

CREATE TABLE performance_metric_definitions (
    metric_id INT AUTO_INCREMENT PRIMARY KEY,

    sport_id INT NOT NULL,

    metric_name VARCHAR(100) NOT NULL,

    description VARCHAR(255),

    unit VARCHAR(50),

    CONSTRAINT fk_metric_sport
        FOREIGN KEY (sport_id)
        REFERENCES sports(sport_id)
        ON DELETE CASCADE
);


-- ============================================================
-- 19. PERFORMANCE RECORDS
-- ============================================================

CREATE TABLE performance_records (
    performance_record_id INT AUTO_INCREMENT PRIMARY KEY,

    athlete_id INT NOT NULL,

    metric_id INT NOT NULL,

    recorded_value DECIMAL(10,2) NOT NULL,

    recorded_date DATE NOT NULL,

    coach_id INT,

    notes TEXT,

    CONSTRAINT fk_performance_athlete
        FOREIGN KEY (athlete_id)
        REFERENCES athlete_profiles(athlete_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_performance_metric
        FOREIGN KEY (metric_id)
        REFERENCES performance_metric_definitions(metric_id),

    CONSTRAINT fk_performance_coach
        FOREIGN KEY (coach_id)
        REFERENCES coach_profiles(coach_id)
        ON DELETE SET NULL
);


-- ============================================================
-- 20. SCHEDULES
-- ============================================================

CREATE TABLE schedules (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,

    title VARCHAR(200) NOT NULL,

    description TEXT,

    schedule_type ENUM(
        'TRAINING',
        'COMPETITION',
        'ACADEMIC',
        'MEETING',
        'OTHER'
    ) NOT NULL,

    start_datetime DATETIME NOT NULL,

    end_datetime DATETIME,

    location VARCHAR(200),

    created_by INT,

    CONSTRAINT fk_schedule_creator
        FOREIGN KEY (created_by)
        REFERENCES users(user_id)
        ON DELETE SET NULL
);


-- ============================================================
-- 21. ANNOUNCEMENTS
-- ============================================================

CREATE TABLE announcements (
    announcement_id INT AUTO_INCREMENT PRIMARY KEY,

    created_by INT NOT NULL,

    title VARCHAR(200) NOT NULL,

    message TEXT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_announcement_creator
        FOREIGN KEY (created_by)
        REFERENCES users(user_id)
);


-- ============================================================
-- 22. NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    title VARCHAR(200) NOT NULL,

    message TEXT NOT NULL,

    notification_type VARCHAR(50),

    is_read BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

USE athlete_hub;

SELECT * FROM users