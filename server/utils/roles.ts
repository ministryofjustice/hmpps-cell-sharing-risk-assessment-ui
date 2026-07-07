/**
 * HMPPS Auth role names (with the `ROLE_` prefix stripped, matching how they are stored on
 * `res.locals.user.userRoles` — see server/middleware/setUpCurrentUser.ts).
 */
export const Role = {
  // Allows a user to view a prisoner regardless of caseload.
  GLOBAL_SEARCH: 'GLOBAL_SEARCH',
  // Allows a user to view prisoners who are no longer in an establishment (released/transferred).
  INACTIVE_BOOKINGS: 'INACTIVE_BOOKINGS',
} as const

export type Role = (typeof Role)[keyof typeof Role]
