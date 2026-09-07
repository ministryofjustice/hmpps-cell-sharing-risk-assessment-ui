import { HmppsUser } from '../../interfaces/hmppsUser'
import { Prisoner } from '../../data/prisonerSearchApiTypes'
import { Breadcrumb } from '../../middleware/addBreadcrumb'
import { OriginKey } from '../../utils/breadcrumbOrigins'

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

    interface Request {
      verified?: boolean
      id: string
      logout(done: (err: unknown) => void): void
    }

    interface Locals {
      user: HmppsUser
      // Populated by checkPrisonerAccess once the caseload/role check has passed, so route
      // handlers can reuse the looked-up prisoner without a second prisoner-search call.
      prisoner?: Prisoner
      // The breadcrumb trail for this request, rendered by views/macros/breadcrumb.njk. Written only
      // through pushBreadcrumbs (middleware/addBreadcrumb.ts).
      breadcrumbs?: Breadcrumb[]
      // The worklist this prisoner page was reached from, and the query string that carries it on to
      // the page's own links. Set by middleware/csraBreadcrumbs.ts; always a whitelisted key, never
      // the raw query value.
      fromKey?: OriginKey
      fromQuery?: string
    }
  }
}
