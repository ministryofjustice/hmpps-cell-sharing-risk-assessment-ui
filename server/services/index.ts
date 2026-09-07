import { dataAccess } from '../data'
import AuditService from './auditService'
import AuthService from './authService'
import CsraService from './csraService'
import PrisonerSearchService from './prisonerSearchService'
import PrisonApiService from './prisonApiService'
import ManageUsersService from './manageUsersService'
import ActiveAgenciesService from './activeAgenciesService'

export const services = () => {
  const {
    applicationInfo,
    hmppsAuditClient,
    hmppsAuthClient,
    csraApiClient,
    prisonerSearchApiClient,
    prisonApiClient,
    prisonApiSplashClient,
    manageUsersApiClient,
  } = dataAccess()

  return {
    applicationInfo,
    auditService: new AuditService(hmppsAuditClient),
    csraService: new CsraService(csraApiClient),
    prisonerSearchService: new PrisonerSearchService(prisonerSearchApiClient),
    prisonApiService: new PrisonApiService(prisonApiClient, prisonApiSplashClient),
    manageUsersService: new ManageUsersService(manageUsersApiClient),
    authService: new AuthService(hmppsAuthClient),
    activeAgenciesService: new ActiveAgenciesService(csraApiClient),
  }
}

export type Services = ReturnType<typeof services>
