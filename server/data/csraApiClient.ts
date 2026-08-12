import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import BaseApiClient from './baseApiClient'
import { RedisClient } from './redisClient'
import type {
  CsraAssessmentsInProgress,
  AgencyStatus,
  CsraCurrentRating,
  CsraHighRiskDueForReview,
  CsraHighRiskDueForReviewQuery,
  CsraHistoryQuery,
  CsraPrisonPrisonerList,
  CsraPrisonPrisonersQuery,
  CsraPrisonRatingSummary,
  CsraRecentArrivals,
  CsraRecentArrivalsQuery,
  CsraReviewDetail,
  CsraReviewHistory,
} from './csraApiTypes'

export default class CsraApiClient extends BaseApiClient {
  constructor(redisClient: RedisClient, authenticationClient: AuthenticationClient) {
    super('CsraAPI', redisClient, config.apis.csraApi, authenticationClient)
  }

  /**
   * Get a prisoner's current CSRA rating.
   *
   * Called with a system (client-credentials) token stamped with the acting username, as the CSRA API
   * grants the ROLE_CSRA_REVIEW__R role to the system client. This endpoint never 404s: when the
   * prisoner has no assessment it returns a rating with `status: 'NO_RATING'`.
   */
  getCurrentCsraRating = this.apiCall<CsraCurrentRating, { prisonerNumber: string }>({
    path: '/csra-review/prisoner/:prisonerNumber/current-rating',
    requestType: 'get',
    options: { asSystem: true },
  })

  /**
   * Get a prison's in-progress initial assessments, split by whether a provisional rating exists.
   * Called `asSystem` (see getCurrentCsraRating).
   */
  getAssessmentsInProgress = this.apiCall<CsraAssessmentsInProgress, { prisonId: string }>({
    path: '/csra-review/prison/:prisonId/assessments-in-progress',
    requestType: 'get',
    options: { asSystem: true },
  })

  /**
   * Get a page of a prisoner's CSRA history (newest first) plus whole-history summary counts.
   *
   * Called `asSystem` (see getCurrentCsraRating). Filters (`ratings`, `fromDate`, `toDate`) and paging
   * (`page`, `size`) are passed as query params; the API returns an empty list with zeroed counts when
   * the prisoner has no history.
   */
  getCsraHistory = this.apiCall<CsraReviewHistory, { prisonerNumber: string } & CsraHistoryQuery>({
    path: '/csra-review/prisoner/:prisonerNumber/history',
    requestType: 'get',
    queryParams: ['page', 'size', 'ratings', 'establishments', 'fromDate', 'toDate'],
    options: { asSystem: true },
  })

  /**
   * Get a single CSRA review by its id, with the full legacy NOMIS record where the review came from
   * NOMIS.
   *
   * Called `asSystem` (see getCurrentCsraRating). Unlike the other reads this one **404s** when the id
   * is unknown, and it is **not prisoner-scoped** — the prisoner is not in the path, so a caller
   * showing this under a prisoner's URL must check the returned `prisonerNumber` matches.
   */
  getCsraReview = this.apiCall<CsraReviewDetail, { id: string }>({
    path: '/csra-review/:id',
    requestType: 'get',
    options: { asSystem: true },
  })

  /**
   * Get the high-risk prisoners in a prison who have a scheduled next review date.
   * Called `asSystem` (see getCurrentCsraRating).
   */
  getHighRiskDueForReview = this.apiCall<
    CsraHighRiskDueForReview,
    { prisonId: string } & CsraHighRiskDueForReviewQuery
  >({
    path: '/csra-review/prison/:prisonId/high-risk-due-for-review',
    requestType: 'get',
    queryParams: ['ratingTypes', 'reviewDateFrom', 'reviewDateTo', 'sort', 'direction'],
    options: { asSystem: true },
  })

  /**
   * Get a paged, filterable, sortable list of everyone currently in the prison with their current
   * CSRA rating. Called `asSystem` (see getCurrentCsraRating).
   */
  getPrisonPrisoners = this.apiCall<CsraPrisonPrisonerList, { prisonId: string } & CsraPrisonPrisonersQuery>({
    path: '/csra-review/prison/:prisonId/prisoners',
    requestType: 'get',
    queryParams: ['page', 'size', 'sort', 'direction', 'ratings', 'assessmentTypes', 'fromDate', 'toDate'],
    options: { asSystem: true },
  })

  /**
   * Get prisoners who recently arrived at a prison and are still in the establishment.
   * Arrivals come from prison-api movements; anyone no longer in the establishment is excluded via the
   * prisoner-search roll. One row per prisoner (their most recent arrival). Called `asSystem`.
   */
  getRecentArrivals = this.apiCall<CsraRecentArrivals, { prisonId: string } & CsraRecentArrivalsQuery>({
    path: '/csra-review/prison/:prisonId/recent-arrivals',
    requestType: 'get',
    queryParams: ['days', 'arrivalTypes'],
    options: { asSystem: true },
  })

  /**
   * Get CSRA rating counts for a prison's current roll (the homepage tile counts).
   * Called `asSystem` (see getCurrentCsraRating).
   */
  getRatingSummary = this.apiCall<CsraPrisonRatingSummary, { prisonId: string }>({
    path: '/csra-review/prison/:prisonId/rating-summary',
    requestType: 'get',
    options: { asSystem: true },
  })

  /**
   * List every prison with whether the CSRA service is switched on, for the rollout admin console.
   * Called `asSystem` (see getCurrentCsraRating); the system client must hold ROLE_PRISONER_CSRA__ADMIN.
   */
  getAllAgencies = this.apiCall<AgencyStatus[], Record<string, never>>({
    path: '/active-agencies/all',
    requestType: 'get',
    options: { asSystem: true },
  })

  /**
   * Switch the CSRA service on or off in DPS for a prison. Idempotent. Called `asSystem`; the system
   * client must hold ROLE_PRISONER_CSRA__ADMIN.
   */
  setAgencyActive = this.apiCall<AgencyStatus, { agencyId: string }, { active: boolean }>({
    path: '/active-agencies/:agencyId',
    requestType: 'put',
    options: { asSystem: true },
  })

  /**
   * The ids of the prisons the CSRA service is switched on for, from the public `/info` endpoint's
   * `activeAgencies` array.
   *
   * Called **unauthenticated** (no token): `/info` is public and this sits on the ordinary read path,
   * so we avoid needing the privileged admin token here. Written directly rather than through
   * `apiCall`, which always attaches a token. Returns `[]` when the key is absent (e.g. an older API
   * deploy) so callers degrade safely to "no prison switched on".
   */
  async getActiveAgencyIds(): Promise<string[]> {
    const info = await this.get<{ activeAgencies?: string[] }>({ path: '/info' })
    return info?.activeAgencies ?? []
  }
}
