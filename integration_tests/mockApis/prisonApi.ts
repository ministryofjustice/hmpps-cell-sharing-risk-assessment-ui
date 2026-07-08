import type { SuperAgentRequest } from 'superagent'
import { stubFor } from './wiremock'

// 1x1 transparent PNG, enough for the banner <img> to load in tests.
const PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: '/prison-api/health/ping',
      },
      response: {
        status: httpStatus,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: { status: httpStatus === 200 ? 'UP' : 'DOWN' },
      },
    }),

  stubGetPrisonerImage: (prisonerNumber: string): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: `/prison-api/api/bookings/offenderNo/${prisonerNumber}/image/data`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
        base64Body: PIXEL_PNG_BASE64,
      },
    }),
}
