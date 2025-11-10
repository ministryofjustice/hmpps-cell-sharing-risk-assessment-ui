import { dataAccess } from '../data'
import AuditService from './auditService'
import AuthService from './authService'
import CsraService from './csraService'

export const services = () => {
  const { applicationInfo, hmppsAuditClient, hmppsAuthClient, csraApiClient } = dataAccess()

  return {
    applicationInfo,
    auditService: new AuditService(hmppsAuditClient),
    csraService: new CsraService(csraApiClient),
    authService: new AuthService(hmppsAuthClient),
  }
}

export type Services = ReturnType<typeof services>
