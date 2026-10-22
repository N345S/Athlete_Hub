// Parts of Athlete-Hub that are switched off but kept in the code so they can come back.

/**
 * The Registrar role is hidden: eligibility decisions from Grade Evaluation PDFs are no longer shown anywhere.
 * Grades now come from the ICTD university database instead (Director portal → Grades). To bring the Registrar
 * back, set this to true and remove REGISTRAR from HiddenRoles in backend/AthleteHub.API/Services/HiddenRoles.cs.
 */
export const REGISTRAR_ELIGIBILITY = false
