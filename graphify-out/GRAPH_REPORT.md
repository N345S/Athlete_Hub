# Graph Report - Athlete_Hub  (2026-10-06)

## Corpus Check
- 145 files · ~227,145 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2019 file(s) not represented in the graph (top: .dll 1832, .cache 97, .pdb 27)

## Summary
- 1213 nodes · 1912 edges · 98 communities (48 shown, 50 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.85)
- Token cost: 52,268 input · 0 output

## Community Hubs (Navigation)
- API Controllers Hub
- Web Frontend API Client
- Eligibility & Grade Review
- Athlete Portfolio
- Role Dashboards
- Admin User Management
- Grade Evaluations & Imports
- Schedules & Calendars
- Static Student Frontend Pages
- Training Sessions & Attendance
- EF Core Migrations
- Web Build Dependencies
- Performance Tracking API
- Database Context
- Director Coach Assignment
- Core SQL Schema
- Achievements API
- Authentication
- Training Session Model
- Academic Records API
- Athlete Profile Model
- Expo App Config
- Achievement Model
- Athlete Profile API
- Documents API
- Performance Record Model
- Launch Settings
- Mobile App Screens
- Document Model
- Mobile Package Manifest
- Mobile Dependencies
- Request DTOs
- Grade Evaluation DTOs
- Training Session Request DTO
- Team Model
- Admin Update User DTO
- Portfolio Response DTO
- Performance Metric Definitions
- Backend Project & Packages
- Roles & Model Building
- Admin Create User DTO
- Announcement Model
- Attendance Model
- Sport Model
- EF Model Snapshot
- Oxlint Config
- Eligibility Request DTO
- SQL Dump: Academic Records
- SQL Dump: Academic Records (copy)
- SQL Dump: Performance Records
- SQL Dump: Performance Records (copy)
- Universal Performance Tracking Migration
- Mobile npm Scripts
- Mobile TypeScript Config
- SQL Dump: Achievements
- SQL Dump: Achievements (copy)
- SQL Dump: Attendance
- SQL Dump: Attendance (copy)
- SQL Dump: Eligibility Records
- SQL Dump: Eligibility Records (copy)
- SQL Dump: Portfolio Items
- SQL Dump: Portfolio Items (copy)
- SQL Dump: Team Members
- SQL Dump: Team Members (copy)
- SQL Dump: Teams
- SQL Dump: Teams (copy)
- SQL Dump: Training Sessions
- SQL Dump: Training Sessions (copy)
- Mobile Agent Guidelines
- SQL Dump: Academic Import Batches
- SQL Dump: Academic Import Batches (copy)
- SQL Dump: Announcements
- SQL Dump: Announcements (copy)
- SQL Dump: Athlete Profiles
- SQL Dump: Athlete Profiles (copy)
- SQL Dump: Coach Profiles
- SQL Dump: Coach Profiles (copy)
- SQL Dump: Documents
- SQL Dump: Documents (copy)
- SQL Dump: Notifications
- SQL Dump: Notifications (copy)
- SQL Dump: Performance Metric Definitions
- SQL Dump: Performance Metric Definitions (copy)
- SQL Dump: Schedules
- SQL Dump: Schedules (copy)
- SQL Dump: Users
- SQL Dump: Users (copy)
- Mobile Entry Point
- Mobile Dev Dependencies
- SQL Dump: Academic Terms
- SQL Dump: Academic Terms (copy)
- SQL Dump: Roles
- SQL Dump: Roles (copy)
- SQL Dump: Sports
- SQL Dump: Sports (copy)

## God Nodes (most connected - your core abstractions)
1. `AthleteHubDbContext` - 67 edges
2. `AthleteHub.API.Models` - 36 edges
3. `AthleteProfile` - 36 edges
4. `User` - 36 edges
5. `AthleteHub.API.Data` - 29 edges
6. `TrainingSession` - 28 edges
7. `AthleteHub.API.DTOs` - 27 edges
8. `Achievement` - 24 edges
9. `EligibilityRecord` - 24 edges
10. `PerformanceRecord` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Web App Entry HTML` --semantically_similar_to--> `Login Page`  [AMBIGUOUS] [semantically similar]
  web/index.html → frontend/index.html
- `Dashboard Page` --semantically_similar_to--> `Student Dashboard Page`  [INFERRED] [semantically similar]
  frontend/dashboard.html → frontend/student-dashboard.html
- `AcademicRecordsController` --references--> `AthleteHubDbContext`  [EXTRACTED]
  backend/AthleteHub.API/Controllers/AcademicRecordsController.cs → backend/AthleteHub.API/Data/AthleteHubDbContext.cs
- `AchievementsController` --references--> `AthleteHubDbContext`  [EXTRACTED]
  backend/AthleteHub.API/Controllers/AchievementsController.cs → backend/AthleteHub.API/Data/AthleteHubDbContext.cs
- `AdminController` --references--> `AthleteHubDbContext`  [EXTRACTED]
  backend/AthleteHub.API/Controllers/AdminController.cs → backend/AthleteHub.API/Data/AthleteHubDbContext.cs

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Student Portal Pages** — frontend_student_dashboard, frontend_student_documents, frontend_student_grades, frontend_student_notifications, frontend_student_portfolio, frontend_student_profile, frontend_student_schedule, frontend_student_portal_sidebar_nav [EXTRACTED 1.00]
- **Pages calling backend APIs via script.js** — frontend_script, frontend_index, frontend_student_documents, frontend_student_schedule, api_auth_login_endpoint, api_documents_endpoint, api_documents_me_endpoint, api_schedules_athlete_endpoint [INFERRED 0.85]

## Communities (98 total, 50 thin omitted)

### Community 0 - "API Controllers Hub"
Cohesion: 0.10
Nodes (4): AthleteHub.API.Models, AthleteHub.API.Controllers, AthleteHub.API.Migrations, AthleteHub.API.Data

### Community 1 - "Web Frontend API Client"
Cohesion: 0.07
Nodes (45): chart.js, react-chartjs-2, react-dom, API_BASE_URL, apiDelete(), apiFetch(), apiGet(), apiPost() (+37 more)

### Community 2 - "Eligibility & Grade Review"
Cohesion: 0.07
Nodes (28): EligibilityController, EligibilityReviewRequest, AcademicStatus, AcademicYear, AthleteId, Reasons, Remarks, Semester (+20 more)

### Community 3 - "Athlete Portfolio"
Cohesion: 0.07
Nodes (28): PortfolioController, AchievementVerificationRequest, RejectionReason, Status, PortfolioItemRequest, AchievementId, Description, DisplayOrder (+20 more)

### Community 4 - "Role Dashboards"
Cohesion: 0.06
Nodes (8): AdminDashboardController, CoachDashboardController, DatabaseTestController, DirectorDashboardController, NotificationsController, RegistrarDashboardController, RoleController, RoleTestController

### Community 5 - "Admin User Management"
Cohesion: 0.06
Nodes (30): AdminController, CoachProfile, CoachId, PerformanceRecords, Specialization, Teams, TrainingSessions, User (+22 more)

### Community 6 - "Grade Evaluations & Imports"
Cohesion: 0.05
Nodes (34): GradeEvaluationsController, AcademicImportBatch, AcademicRecords, FileName, ImportBatchId, ImportedAt, ImportedBy, ImportedByNavigation (+26 more)

### Community 7 - "Schedules & Calendars"
Cohesion: 0.08
Nodes (21): SchedulesController, ScheduleRequest, Dates, Description, EndDate, EndTime, Location, ScheduleType (+13 more)

### Community 8 - "Static Student Frontend Pages"
Cohesion: 0.10
Nodes (36): /api/Auth/login endpoint, /api/Documents endpoint, /api/Documents/me endpoint, /api/Schedules/athlete endpoint, Dashboard Page, Login Page, Login Form (loginForm), documentDescriptionInput (+28 more)

### Community 9 - "Training Sessions & Attendance"
Cohesion: 0.10
Nodes (16): TrainingController, AttendanceRequest, AthleteId, AttendanceStatus, Remarks, TrainingApprovalRequest, RejectionReason, Notification (+8 more)

### Community 10 - "EF Core Migrations"
Cohesion: 0.07
Nodes (6): InitialAthleteHubSchema, AddAchievementRejectionReason, ReconcileLegacySchema, RepairAchievementRejectionReason, RepairPerformanceRecordSchema, AddEligibilityEvaluationWorkflow

### Community 11 - "Web Build Dependencies"
Cohesion: 0.07
Nodes (28): oxlint, @types/react-dom, vite, @vitejs/plugin-react, @vitejs/plugin-react-oxc, dependencies, chart.js, react (+20 more)

### Community 12 - "Performance Tracking API"
Cohesion: 0.15
Nodes (10): PerformanceController, PerformanceRecordRequest, AthleteId, DataType, MetricId, Notes, RecordedDate, RecordedValue (+2 more)

### Community 13 - "Database Context"
Cohesion: 0.08
Nodes (22): AthleteHubDbContext, AcademicImportBatches, AcademicRecords, AcademicTerms, Achievements, Announcements, AthleteProfiles, Attendances (+14 more)

### Community 14 - "Director Coach Assignment"
Cohesion: 0.14
Nodes (11): AssignAthleteRequest, AthleteId, DirectorController, TeamMember, Athlete, AthleteId, DateJoined, DateLeft (+3 more)

### Community 15 - "Core SQL Schema"
Cohesion: 0.22
Nodes (21): academic_import_batches, academic_records, academic_terms, achievements, announcements, athlete_profiles, attendance, coach_profiles (+13 more)

### Community 16 - "Achievements API"
Cohesion: 0.17
Nodes (6): AchievementsController, CreateAchievementRequest, AchievementDate, Category, Description, Title

### Community 17 - "Authentication"
Cohesion: 0.11
Nodes (12): AuthController, LoginRequest, Email, Password, RegisterRequest, Email, FirstName, LastName (+4 more)

### Community 18 - "Training Session Model"
Cohesion: 0.10
Nodes (18): TrainingSession, ApprovalStatus, Attendances, Coach, CoachId, Description, EndTime, Location (+10 more)

### Community 19 - "Academic Records API"
Cohesion: 0.16
Nodes (9): AcademicRecordsController, UpdateAcademicRecordRequest, AcademicYear, Grade, Remarks, Semester, SubjectCode, SubjectName (+1 more)

### Community 20 - "Athlete Profile Model"
Cohesion: 0.11
Nodes (17): AthleteProfile, AcademicRecords, Achievements, AthleteId, Attendances, BirthDate, Course, Documents (+9 more)

### Community 21 - "Expo App Config"
Cohesion: 0.11
Nodes (18): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+10 more)

### Community 22 - "Achievement Model"
Cohesion: 0.12
Nodes (15): Achievement, AchievementDate, AchievementId, Athlete, AthleteId, Category, CreatedAt, Description (+7 more)

### Community 23 - "Athlete Profile API"
Cohesion: 0.15
Nodes (7): AthleteProfileController, UpdateAthleteProfileRequest, BirthDate, Course, Phone, ProfilePhotoUrl, YearLevel

### Community 25 - "Performance Record Model"
Cohesion: 0.12
Nodes (15): PerformanceRecord, Athlete, AthleteId, Coach, CoachId, DataType, Metric, MetricId (+7 more)

### Community 26 - "Launch Settings"
Cohesion: 0.13
Nodes (15): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, applicationUrl, commandName (+7 more)

### Community 27 - "Mobile App Screens"
Cohesion: 0.14
Nodes (12): getStoredSession(), LoginScreen(), RootStackParamList, Session, Stack, StudentDashboardScreen(), styles, @react-native-async-storage/async-storage (+4 more)

### Community 28 - "Document Model"
Cohesion: 0.14
Nodes (13): Document, Achievement, AchievementId, Athlete, AthleteId, Description, DocumentId, DocumentName (+5 more)

### Community 29 - "Mobile Package Manifest"
Cohesion: 0.14
Nodes (13): react, @types/react, main, name, private, version, expo-status-bar, react-native (+5 more)

### Community 30 - "Mobile Dependencies"
Cohesion: 0.14
Nodes (14): dependencies, expo, expo-status-bar, react, react-native, @react-native-async-storage/async-storage, react-native-chart-kit, @react-native-picker/picker (+6 more)

### Community 32 - "Grade Evaluation DTOs"
Cohesion: 0.17
Nodes (11): GradeEvaluationItem, Grade, Remarks, SubjectCode, SubjectName, Units, SendGradeEvaluationRequest, AcademicYear (+3 more)

### Community 33 - "Training Session Request DTO"
Cohesion: 0.17
Nodes (9): TrainingSessionRequest, Description, EndTime, Location, StartTime, TeamId, Title, TrainingDate (+1 more)

### Community 34 - "Team Model"
Cohesion: 0.17
Nodes (11): Team, Coach, CoachId, SchoolYear, Sport, SportId, Status, TeamId (+3 more)

### Community 35 - "Admin Update User DTO"
Cohesion: 0.18
Nodes (10): UpdateAdminUserRequest, AccountStatus, Email, FirstName, LastName, MiddleName, Password, Phone (+2 more)

### Community 36 - "Portfolio Response DTO"
Cohesion: 0.20
Nodes (8): PortfolioItemResponse, AchievementId, CreatedAt, Description, DisplayOrder, IsVisible, PortfolioItemId, Title

### Community 37 - "Performance Metric Definitions"
Cohesion: 0.20
Nodes (9): PerformanceMetricDefinition, DataType, Description, MetricId, MetricName, PerformanceRecords, Sport, SportId (+1 more)

### Community 38 - "Backend Project & Packages"
Cohesion: 0.22
Nodes (8): net10.0, BCrypt.Net-Next (4.2.0), Microsoft.AspNetCore.Authentication.JwtBearer (10.0.11), Microsoft.AspNetCore.OpenApi (10.0.10), Microsoft.EntityFrameworkCore (10.0.10), Microsoft.EntityFrameworkCore.Design (10.0.10), MySql.EntityFrameworkCore (10.0.9), Microsoft.NET.Sdk.Web

### Community 39 - "Roles & Model Building"
Cohesion: 0.25
Nodes (5): Role, Description, RoleId, RoleName, Users

### Community 40 - "Admin Create User DTO"
Cohesion: 0.22
Nodes (9): CreateAdminUserRequest, Email, FirstName, LastName, MiddleName, Password, Phone, RoleId (+1 more)

### Community 41 - "Announcement Model"
Cohesion: 0.25
Nodes (7): Announcement, AnnouncementId, CreatedAt, CreatedBy, CreatedByNavigation, Message, Title

### Community 42 - "Attendance Model"
Cohesion: 0.25
Nodes (8): Attendance, Athlete, AthleteId, AttendanceId, AttendanceStatus, Remarks, TrainingSession, TrainingSessionId

### Community 43 - "Sport Model"
Cohesion: 0.25
Nodes (7): Sport, Description, PerformanceMetricDefinitions, SportId, SportName, SportType, Teams

### Community 45 - "Oxlint Config"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 46 - "Eligibility Request DTO"
Cohesion: 0.40
Nodes (5): EligibilityRecordRequest, AcademicStatus, AthleteId, Remarks, TermId

### Community 52 - "Mobile npm Scripts"
Cohesion: 0.40
Nodes (5): scripts, android, ios, start, web

### Community 53 - "Mobile TypeScript Config"
Cohesion: 0.40
Nodes (4): compilerOptions, strict, extends, expo/tsconfig.base

### Community 68 - "Mobile Agent Guidelines"
Cohesion: 0.50
Nodes (3): Expo SDK, Mobile AGENTS.md, Mobile CLAUDE.md

### Community 88 - "Mobile Dev Dependencies"
Cohesion: 0.67
Nodes (3): devDependencies, @types/react, typescript

## Ambiguous Edges - Review These
- `Login Page` → `Web App Entry HTML`  [AMBIGUOUS]
  web/index.html · relation: semantically_similar_to

## Knowledge Gaps
- **478 isolated node(s):** `net10.0`, `BCrypt.Net-Next (4.2.0)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.11)`, `Microsoft.AspNetCore.OpenApi (10.0.10)`, `Microsoft.EntityFrameworkCore (10.0.10)` (+473 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 706 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Login Page` and `Web App Entry HTML`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `AthleteHubDbContext` connect `Database Context` to `API Controllers Hub`, `Eligibility & Grade Review`, `Athlete Portfolio`, `Role Dashboards`, `Admin User Management`, `Grade Evaluations & Imports`, `Schedules & Calendars`, `Training Sessions & Attendance`, `Performance Tracking API`, `Director Coach Assignment`, `Achievements API`, `Authentication`, `Training Session Model`, `Academic Records API`, `Athlete Profile Model`, `Achievement Model`, `Athlete Profile API`, `Documents API`, `Performance Record Model`, `Document Model`, `Team Model`, `Performance Metric Definitions`, `Roles & Model Building`, `Announcement Model`, `Attendance Model`, `Sport Model`?**
  _High betweenness centrality (0.212) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `AthleteProfile` (e.g. with `.CreateUser()` and `.UpdateUser()`) actually correct?**
  _`AthleteProfile` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `net10.0`, `BCrypt.Net-Next (4.2.0)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.11)` to the rest of the system?**
  _478 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Controllers Hub` be split into smaller, more focused modules?**
  _Cohesion score 0.0958904109589041 - nodes in this community are weakly interconnected._
- **Why does `Achievement` connect `Achievement Model` to `API Controllers Hub`, `Athlete Portfolio`, `Admin User Management`, `Roles & Model Building`, `Database Context`, `Achievements API`, `Athlete Profile Model`, `Document Model`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `User` (e.g. with `.CreateUser()` and `.Register()`) actually correct?**
  _`User` has 2 INFERRED edges - model-reasoned connections that need verification._