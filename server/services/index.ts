import { dataAccess } from '../data'
import AuditService from './auditService'
import AuthService from './authService'
import CsraService from './csraService'
import PrisonerSearchService from './prisonerSearchService'

export const services = () => {
  const { applicationInfo, hmppsAuditClient, hmppsAuthClient, csraApiClient, prisonerSearchApiClient } = dataAccess()

  return {
    applicationInfo,
    auditService: new AuditService(hmppsAuditClient),
    csraService: new CsraService(csraApiClient),
    prisonerSearchService: new PrisonerSearchService(prisonerSearchApiClient),
    authService: new AuthService(hmppsAuthClient),
  }
}

export type Services = ReturnType<typeof services>
