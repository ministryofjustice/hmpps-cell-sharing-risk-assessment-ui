import type { SuperAgentRequest } from 'superagent'
import { stubFor } from './wiremock'
import type { UserCaseloads } from '../../server/data/manageUsersApiTypes'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: '/manage-users-api/health/ping',
      },
      response: {
        status: httpStatus,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: { status: httpStatus === 200 ? 'UP' : 'DOWN' },
      },
    }),

  // Stub the signed-in user's caseloads. Pass the prison ids the user should have access to; the
  // first is treated as the active caseload.
  stubGetUserCaseloads: (caseloadIds: string[] = ['MDI']): SuperAgentRequest => {
    const caseloads: UserCaseloads = {
      username: 'USER1',
      active: true,
      accountType: 'GENERAL',
      activeCaseload: caseloadIds.length ? { id: caseloadIds[0], name: caseloadIds[0] } : undefined,
      caseloads: caseloadIds.map(id => ({ id, name: id })),
    }
    return stubFor({
      request: {
        method: 'GET',
        urlPattern: '/manage-users-api/users/me/caseloads',
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: caseloads,
      },
    })
  },
}
