import { dataAccess } from '../data'
import AuditService from './auditService'
import AuthService from './authService'
import CsraService from './csraService'
import PrisonerSearchService from './prisonerSearchService'
import PrisonApiService from './prisonApiService'
import ManageUsersService from './manageUsersService'
import ActiveAgenciesService from './activeAgenciesService'
import WarrantsService from './warrantsService'
import ChangeSomeonesCellService from './changeSomeonesCellService'

export const services = () => {
  const {
    applicationInfo,
    hmppsAuditClient,
    hmppsAuthClient,
    changeSomeonesCellApiClient,
    csraApiClient,
    prisonerSearchApiClient,
    prisonApiClient,
    prisonApiSplashClient,
    prisonApiAgencySwitchClient,
    manageUsersApiClient,
    courtDataApiClient,
    documentApiClient,
  } = dataAccess()

  return {
    applicationInfo,
    auditService: new AuditService(hmppsAuditClient),
    csraService: new CsraService(csraApiClient),
    changeSomeonesCellService: new ChangeSomeonesCellService(changeSomeonesCellApiClient),
    prisonerSearchService: new PrisonerSearchService(prisonerSearchApiClient),
    prisonApiService: new PrisonApiService(prisonApiClient, prisonApiSplashClient, prisonApiAgencySwitchClient),
    manageUsersService: new ManageUsersService(manageUsersApiClient),
    authService: new AuthService(hmppsAuthClient),
    activeAgenciesService: new ActiveAgenciesService(csraApiClient),
    warrantsService: new WarrantsService(courtDataApiClient, documentApiClient),
  }
}

export type Services = ReturnType<typeof services>
