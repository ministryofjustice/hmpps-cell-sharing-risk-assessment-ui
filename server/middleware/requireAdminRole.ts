import type { RequestHandler } from 'express'

import { Role } from '../utils/roles'

/** Whether the signed-in user may administer the CSRA rollout. Also drives the Admin tile. */
export const canAdminister = (userRoles: string[] = []): boolean => userRoles.includes(Role.CSRA__ADMIN)

/**
 * Gates the rollout admin console on the signed-in user holding the admin user role.
 *
 * This is the only check on the acting user: the console's API calls are made with this service's
 * system token (which holds `ROLE_PRISONER_CSRA__ADMIN`), so the API authorises the calling service,
 * not the person. Every route that changes rollout state must therefore sit behind this middleware.
 *
 * Renders the authorisation-error page rather than signing the user out or redirecting, so someone who
 * reaches the console without the role is simply told they cannot use it. The Admin tile is hidden from
 * those users too, so arriving here without the role means a typed/bookmarked URL.
 *
 * Deliberately not `authorisationMiddleware`: that re-decodes the JWT and redirects to `/authError`,
 * which is not the registered route (`/autherror`), so it would 404 rather than explain the problem.
 */
const requireAdminRole: RequestHandler = (_req, res, next) => {
  if (canAdminister(res.locals.user?.userRoles)) {
    return next()
  }
  res.status(403)
  return res.render('autherror')
}

export default requireAdminRole
