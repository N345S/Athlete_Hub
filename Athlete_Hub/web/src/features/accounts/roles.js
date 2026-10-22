// Registrar and Admin are hidden roles; the API never returns them, but their names still read well.
export const ROLE_LABELS = { ATHLETE: 'Athletes', COACH: 'Coaches', DIRECTOR: 'Directors', REGISTRAR: 'Registrars', ADMIN: 'Admins', PARENT: 'Parents' }
const ROLE_NAMES = { ATHLETE: 'Athlete', COACH: 'Coach', DIRECTOR: 'Sports Director', REGISTRAR: 'Registrar', ADMIN: 'Administrator', PARENT: 'Parent' }
export const roleName = (role) => ROLE_NAMES[role] || role
