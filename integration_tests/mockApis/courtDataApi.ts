import type { SuperAgentRequest } from 'superagent'
import { stubFor } from './wiremock'
import type { CourtHearing } from '../../server/data/courtDataApiTypes'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: '/court-data-api/health/ping',
      },
      response: {
        status: httpStatus,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: { status: httpStatus === 200 ? 'UP' : 'DOWN' },
      },
    }),

  /**
   * The court hearings held for a prisoner. An empty list is what the API returns for a prisoner it
   * could not match against court records, which is the "no warrant information" case.
   */
  stubGetCourtHearings: (prisonerNumber: string, hearings: CourtHearing[]): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: `/court-data-api/court-hearings/prisoner/${prisonerNumber}`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: hearings,
      },
    }),

  stubGetCourtHearingsError: (prisonerNumber: string, httpStatus = 500): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: `/court-data-api/court-hearings/prisoner/${prisonerNumber}`,
      },
      response: { status: httpStatus },
    }),
}
