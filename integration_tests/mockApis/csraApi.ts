import type { SuperAgentRequest } from 'superagent'
import { stubFor } from './wiremock'
import type { CsraCurrentRating, CsraReviewHistory } from '../../server/data/csraApiTypes'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: '/csra-api/health/ping',
      },
      response: {
        status: httpStatus,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: { status: httpStatus === 200 ? 'UP' : 'DOWN' },
      },
    }),

  stubGetCurrentRating: (prisonerNumber: string, currentRating: Partial<CsraCurrentRating> = {}): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: `/csra-api/csra-review/prisoner/${prisonerNumber}/current-rating`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: {
          prisonerNumber,
          status: 'COMPLETE',
          rating: 'STANDARD',
          provisional: false,
          riskTo: [],
          vulnerabilities: [],
          ...currentRating,
        },
      },
    }),

  stubGetCsraHistory: (prisonerNumber: string, history: Partial<CsraReviewHistory> = {}): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPathPattern: `/csra-api/csra-review/prisoner/${prisonerNumber}/history`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: {
          summary: { totalCsras: 0, highCount: 0, standardCount: 0 },
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
          ...history,
        },
      },
    }),
}
