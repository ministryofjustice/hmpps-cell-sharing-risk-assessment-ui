import type { SuperAgentRequest } from 'superagent'
import { stubFor } from './wiremock'
import type { Prisoner } from '../../server/data/prisonerSearchApiTypes'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: '/prisoner-search-api/health/ping',
      },
      response: {
        status: httpStatus,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: { status: httpStatus === 200 ? 'UP' : 'DOWN' },
      },
    }),

  stubGetPrisoner: (prisoner: Prisoner): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: `/prisoner-search-api/prisoner/${prisoner.prisonerNumber}`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: prisoner,
      },
    }),
}
