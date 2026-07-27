/**
 * HMPPS Auth **user** role names (with the `ROLE_` prefix stripped, matching how they are stored on
 * `res.locals.user.userRoles` — see server/middleware/setUpCurrentUser.ts).
 *
 * These are granted to people and gate access to screens and data in this service. They are a
 * deliberately separate set from the **system** roles the CSRA API checks
 * (`ROLE_PRISONER_CSRA__*`, e.g. `ROLE_PRISONER_CSRA__ADMIN`), which are granted to this service's
 * client-credentials client — API calls are made with that system token, never the user's own.
 * Do not use a role from one set in place of the other.
 */
export const Role = {
  // Allows a user to view a prisoner regardless of caseload.
  GLOBAL_SEARCH: 'GLOBAL_SEARCH',
  // Allows a user to view prisoners who are no longer in an establishment (released/transferred).
  INACTIVE_BOOKINGS: 'INACTIVE_BOOKINGS',
  // Allows a user to administer the CSRA rollout: switch prisons on/off in DPS and control the
  // legacy NOMIS CSRA screen. Not caseload-scoped — it is a national control.
  CSRA__ADMIN: 'CSRA__ADMIN',
} as const

export type Role = (typeof Role)[keyof typeof Role]
