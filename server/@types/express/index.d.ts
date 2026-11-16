import { HmppsUser } from '../../interfaces/hmppsUser'
import { Prisoner } from '../../data/prisonerSearchApiTypes'
import { Breadcrumb } from '../../middleware/addBreadcrumb'
import { ReferrerKey } from '../../utils/breadcrumbOrigins'

export declare module 'express-session' {
  // Declare that the session will potentially contain these additional fields
  interface SessionData {
    returnTo: string
    systemToken: string
  }
}

export declare global {
  namespace Express {
    interface User {
      username: string
      token: string
      authSource: string
    }

    interface Flash {
      title: string
      content: string
    }

    interface Request {
      verified?: boolean
      id: string
      logout(done: (err: unknown) => void): void
      flash(message: string): Flash[]
      flash(type: string, message: Flash): Flash[]
    }

    interface Locals {
      user: HmppsUser
      // Populated by checkPrisonerAccess once the caseload/role check has passed, so route
      // handlers can reuse the looked-up prisoner without a second prisoner-search call.
      prisoner?: Prisoner
      // The breadcrumb trail for this request, rendered by views/macros/breadcrumb.njk. Written only
      // through pushBreadcrumbs (middleware/addBreadcrumb.ts).
      breadcrumbs?: Breadcrumb[]
      // The pages this prisoner page was reached through, oldest first (e.g. the worklist, then the
      // history page). Set by middleware/csraBreadcrumbs.ts; always whitelisted keys, never the raw
      // query value. Templates pass it to the appendReferrers global to carry it on to their own links.
      referrers?: ReferrerKey[]
    }
  }
}
