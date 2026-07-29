import express, { Express } from 'express'
import { NotFound } from 'http-errors'

import { randomUUID } from 'crypto'
import routes from '../index'
import nunjucksSetup from '../../utils/nunjucksSetup'
import errorHandler from '../../errorHandler'
import type { Services } from '../../services'
import AuditService from '../../services/auditService'
import { HmppsUser } from '../../interfaces/hmppsUser'
import setUpWebSession from '../../middleware/setUpWebSession'
import CsraService from '../../services/csraService'
import PrisonerSearchService from '../../services/prisonerSearchService'
import ManageUsersService from '../../services/manageUsersService'
import PrisonApiService from '../../services/prisonApiService'
import ActiveAgenciesService from '../../services/activeAgenciesService'

jest.mock('../../services/auditService')

export const user: HmppsUser = {
  name: 'FIRST LAST',
  userId: 'id',
  token: 'token',
  username: 'user1',
  displayName: 'First Last',
  authSource: 'nomis',
  staffId: 1234,
  userRoles: [],
}

export const flashProvider = jest.fn()

function appSetup(services: Services, production: boolean, userSupplier: () => HmppsUser): Express {
  const app = express()

  app.set('view engine', 'njk')

  nunjucksSetup(app)
  app.use(setUpWebSession())
  app.use((req, res, next) => {
    req.user = userSupplier() as Express.User
    req.flash = flashProvider
    res.locals = {
      user: { ...req.user } as HmppsUser,
    }
    next()
  })
  app.use((req, res, next) => {
    req.id = randomUUID()
    next()
  })
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(routes(services))
  app.use((req, res, next) => next(new NotFound()))
  app.use(errorHandler(production))

  return app
}

export function appWithAllRoutes({
  production = false,
  services = {
    auditService: new AuditService(null) as jest.Mocked<AuditService>,
    csraService: new CsraService(null) as jest.Mocked<CsraService>,
    prisonerSearchService: new PrisonerSearchService(null) as jest.Mocked<PrisonerSearchService>,
    manageUsersService: new ManageUsersService(null) as jest.Mocked<ManageUsersService>,
    prisonApiService: new PrisonApiService(null, null) as jest.Mocked<PrisonApiService>,
    // Defaults to no prison switched on, so a test that does not care about rollout still renders.
    activeAgenciesService: {
      getActiveAgencyIds: jest.fn().mockResolvedValue(new Set<string>()),
      isPrisonActive: jest.fn().mockResolvedValue(false),
      invalidate: jest.fn(),
    } as unknown as jest.Mocked<ActiveAgenciesService>,
  },
  userSupplier = () => user,
}: {
  production?: boolean
  services?: Partial<Services>
  userSupplier?: () => HmppsUser
}): Express {
  return appSetup(services as Services, production, userSupplier)
}
