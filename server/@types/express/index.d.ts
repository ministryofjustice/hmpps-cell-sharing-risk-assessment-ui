import { HmppsUser } from '../../interfaces/hmppsUser'
import { Prisoner } from '../../data/prisonerSearchApiTypes'

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
    }
  }
}
