import { CsraApiClient } from '../data'
import type {
  AgencyStatus,
  CsraAssessment,
  CsraAssessmentsInProgress,
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
  CsraReviewsInProgress,
} from '../data/csraApiTypes'

export default class CsraService {
  constructor(private readonly csraApiClient: CsraApiClient) {}

  /**
   * Get a prisoner's current CSRA rating. `username` is stamped onto the system token used for the
   * call (see CsraApiClient.getCurrentCsraRating).
   */
  getCurrentRating(username: string, prisonerNumber: string): Promise<CsraCurrentRating> {
    return this.csraApiClient.getCurrentCsraRating(username, { prisonerNumber })
  }

  /**
   * Get a prison's in-progress initial assessments split by stage.
   * `username` is stamped onto the system token used for the call.
   */
  getAssessmentsInProgress(username: string, prisonId: string): Promise<CsraAssessmentsInProgress> {
    return this.csraApiClient.getAssessmentsInProgress(username, { prisonId })
  }

  /**
   * Get a prison's in-progress CSRA reviews. `username` is stamped onto the system token used for the
   * call.
   */
  getReviewsInProgress(username: string, prisonId: string): Promise<CsraReviewsInProgress> {
    return this.csraApiClient.getReviewsInProgress(username, { prisonId })
  }

  /**
   * Get a page of a prisoner's CSRA history plus whole-history summary counts. `username` is stamped
   * onto the system token used for the call (see CsraApiClient.getCsraHistory).
   */
  getHistory(username: string, prisonerNumber: string, query: CsraHistoryQuery): Promise<CsraReviewHistory> {
    return this.csraApiClient.getCsraHistory(username, { prisonerNumber, ...query })
  }

  /**
   * Get a single CSRA review by id. Rejects with a 404 when the id is unknown, and the review is not
   * guaranteed to belong to any particular prisoner (see CsraApiClient.getCsraReview).
   */
  getReview(username: string, reviewId: string): Promise<CsraReviewDetail> {
    return this.csraApiClient.getCsraReview(username, { id: reviewId })
  }

  /**
   * Get the high-risk prisoners in a prison who have a scheduled next review date.
   * `username` is stamped onto the system token used for the call.
   */
  getHighRiskDueForReview(
    username: string,
    prisonId: string,
    query: CsraHighRiskDueForReviewQuery = {},
  ): Promise<CsraHighRiskDueForReview> {
    return this.csraApiClient.getHighRiskDueForReview(username, { prisonId, ...query })
  }

  /**
   * Get a paged, filterable, sortable list of the prison's current prisoners with their CSRA rating.
   * `username` is stamped onto the system token used for the call.
   */
  getPrisonPrisoners(
    username: string,
    prisonId: string,
    query: CsraPrisonPrisonersQuery = {},
  ): Promise<CsraPrisonPrisonerList> {
    return this.csraApiClient.getPrisonPrisoners(username, { prisonId, ...query })
  }

  /**
   * Get CSRA rating counts for a prison's current roll (no rating, high risk, standard risk).
   * `username` is stamped onto the system token used for the call.
   */
  getRatingSummary(username: string, prisonId: string): Promise<CsraPrisonRatingSummary> {
    return this.csraApiClient.getRatingSummary(username, { prisonId })
  }

  /**
   * Get prisoners who recently arrived at a prison and are still in the establishment.
   * `username` is stamped onto the system token used for the call.
   */
  getRecentArrivals(
    username: string,
    prisonId: string,
    query: CsraRecentArrivalsQuery = {},
  ): Promise<CsraRecentArrivals> {
    return this.csraApiClient.getRecentArrivals(username, { prisonId, ...query })
  }

  /** Every prison with whether CSRA is switched on in DPS, for the rollout admin console. */
  getAllAgencies(username: string): Promise<AgencyStatus[]> {
    return this.csraApiClient.getAllAgencies(username, {})
  }

  /** Switch CSRA on or off in DPS for a prison. Idempotent. */
  setAgencyActive(username: string, agencyId: string, active: boolean): Promise<AgencyStatus> {
    return this.csraApiClient.setAgencyActive(username, { agencyId }, { active })
  }

  async getCsraAssessment(prisonerNumber: string, assessmentId: string) {
    const redisId = `CSRAQ_${prisonerNumber}_${assessmentId}`
    const redisGet = (await this.csraApiClient.TEMP_getRedisClient().get(redisId)) as string
    return redisGet ? JSON.parse(redisGet) : {}
  }

  async updateCsraAssessment(prisonerNumber: string, assessmentId: string, assessment: CsraAssessment) {
    const redisId = `CSRAQ_${prisonerNumber}_${assessmentId}`
    await this.csraApiClient.TEMP_getRedisClient().set(redisId, JSON.stringify(assessment))

    return assessment
  }
}
