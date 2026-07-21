import { CsraApiClient } from '../data'
import type {
  CsraCurrentRating,
  CsraHistoryQuery,
  CsraPrisonRatingSummary,
  CsraReviewHistory,
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
   * Get a page of a prisoner's CSRA history plus whole-history summary counts. `username` is stamped
   * onto the system token used for the call (see CsraApiClient.getCsraHistory).
   */
  getHistory(username: string, prisonerNumber: string, query: CsraHistoryQuery): Promise<CsraReviewHistory> {
    return this.csraApiClient.getCsraHistory(username, { prisonerNumber, ...query })
  }

  /**
   * Get CSRA rating counts for a prison's current roll (no rating, high risk, standard risk).
   * `username` is stamped onto the system token used for the call.
   */
  getRatingSummary(username: string, prisonId: string): Promise<CsraPrisonRatingSummary> {
    return this.csraApiClient.getRatingSummary(username, { prisonId })
  }
}
