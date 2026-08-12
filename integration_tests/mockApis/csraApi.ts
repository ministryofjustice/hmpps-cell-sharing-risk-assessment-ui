import type { SuperAgentRequest } from 'superagent'
import { stubFor } from './wiremock'
import type {
  AgencyStatus,
  CsraAssessmentsInProgress,
  CsraCurrentRating,
  CsraHighRiskDueForReview,
  CsraPrisonPrisonerList,
  CsraRecentArrivals,
  CsraReviewDetail,
  CsraReviewHistory,
} from '../../server/data/csraApiTypes'

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

  stubGetCsraReview: (reviewId: string, review: Partial<CsraReviewDetail> = {}): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: `/csra-api/csra-review/${reviewId}`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: {
          id: reviewId,
          prisonerNumber: 'A5197BD',
          prisonId: 'LEI',
          prisonName: 'Leeds (HMP)',
          assessmentDate: '2016-10-31',
          type: 'REVIEW',
          createdAt: '2016-10-31T09:15:00',
          createdBy: 'NQP56Y',
          ...review,
        },
      },
    }),

  stubGetCsraReviewNotFound: (reviewId: string): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: `/csra-api/csra-review/${reviewId}`,
      },
      response: {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: { status: 404, userMessage: 'CSRA review not found' },
      },
    }),

  stubGetAssessmentsInProgress: (
    prisonId = 'LEI',
    assessmentsInProgress: Partial<CsraAssessmentsInProgress> = {},
  ): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPathPattern: `/csra-api/csra-review/prison/${prisonId}/assessments-in-progress`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: {
          assessmentStarted: [
            {
              reviewId: 'de91dfa7-821f-4552-a427-bf2f32eafeb0',
              prisonerNumber: 'A9354JF',
              firstName: 'Simon',
              lastName: 'Kettleby',
              startedOn: '2026-07-06',
              startedBy: 'JBLOGGS',
            },
          ],
          provisionalRatingEntered: [
            {
              reviewId: '6a4fa388-3aae-4c9f-8fc7-fb85ac2ed27f',
              prisonerNumber: 'A5197BD',
              firstName: 'Daniel',
              lastName: 'Havers',
              assessedOn: '2026-07-06',
              assessedBy: 'MSTANLEY',
              rating: 'HIGH_SPECIFIC',
            },
          ],
          ...assessmentsInProgress,
        },
      },
    }),

  stubGetHighRiskDueForReview: (
    prisonId = 'LEI',
    dueForReview: Partial<CsraHighRiskDueForReview> = {},
  ): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPathPattern: `/csra-api/csra-review/prison/${prisonId}/high-risk-due-for-review`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: {
          content: [
            {
              prisonerNumber: 'A1049JF',
              firstName: 'CALLUM',
              lastName: 'REID',
              reviewDueBy: '2026-06-29',
              ratingType: 'HIGH_GENERAL',
              rating: 'HIGH_GENERAL',
              provisional: false,
              lastRatingSource: 'ASSESSMENT',
              lastRatingDate: '2025-06-24',
            },
          ],
          totalResults: 1,
          availableRatingTypes: ['HIGH_GENERAL', 'HIGH_SPECIFIC'],
          ...dueForReview,
        },
      },
    }),

  stubGetRatingSummary: (prisonId: string, summary: Record<string, number> = {}): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: `/csra-api/csra-review/prison/${prisonId}/rating-summary`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: { prisonId, total: 10, noRating: 1, highRisk: 2, standardRisk: 7, ...summary },
      },
    }),

  stubGetPrisonPrisoners: (prisonId = 'LEI', prisoners: Partial<CsraPrisonPrisonerList> = {}): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPathPattern: `/csra-api/csra-review/prison/${prisonId}/prisoners`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: {
          content: [
            {
              prisonerNumber: 'A1049JF',
              firstName: 'CALLUM',
              lastName: 'REID',
              rating: 'HIGH_GENERAL',
              provisional: false,
              assessmentType: 'ASSESSMENT',
              assessedOn: '2026-03-05',
            },
          ],
          page: 0,
          size: 25,
          totalElements: 1,
          totalPages: 1,
          ...prisoners,
        },
      },
    }),

  /** The public /info endpoint the UI reads to know which prisons have CSRA switched on. */
  stubGetInfo: (activeAgencies: string[] = []): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: '/csra-api/info',
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: { build: { name: 'hmpps-cell-sharing-risk-assessment-api' }, activeAgencies },
      },
    }),

  stubGetAllAgencies: (agencies: AgencyStatus[], priority?: number): SuperAgentRequest =>
    stubFor({
      priority,
      request: {
        method: 'GET',
        urlPattern: '/csra-api/active-agencies/all',
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: agencies,
      },
    }),

  stubSetAgencyActive: (agency: AgencyStatus): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'PUT',
        urlPattern: `/csra-api/active-agencies/${agency.agencyId}`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: agency,
      },
    }),

  stubGetRecentArrivals: (prisonId = 'LEI', recentArrivals: Partial<CsraRecentArrivals> = {}): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPathPattern: `/csra-api/csra-review/prison/${prisonId}/recent-arrivals`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: {
          days: [
            {
              date: '2026-08-06',
              arrivals: [
                {
                  prisonerNumber: 'A5197BD',
                  firstName: 'DANIEL',
                  lastName: 'HAVERS',
                  dateOfBirth: '1972-02-03',
                  arrivalType: 'NEW_ADMISSION',
                  arrivedAt: '2026-08-06T14:03:00',
                  location: 'RECP',
                },
              ],
            },
            { date: '2026-08-05', arrivals: [] },
            { date: '2026-08-04', arrivals: [] },
          ],
          totalResults: 1,
          arrivalTypeCounts: { NEW_ADMISSION: 1, TRANSFER_IN: 0, COURT_RETURN: 0, TEMPORARY_ABSENCE_RETURN: 0 },
          fromDate: '2026-08-04',
          toDate: '2026-08-06',
          ...recentArrivals,
        },
      },
    }),
}
