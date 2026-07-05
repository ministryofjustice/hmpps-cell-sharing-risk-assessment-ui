import { CsraApiClient } from '../data'
import type { CsraCurrentRating } from '../data/csraApiTypes'

export default class CsraService {
  constructor(private readonly csraApiClient: CsraApiClient) {}

  /**
   * Get a prisoner's current CSRA rating. `username` is stamped onto the system token used for the
   * call (see CsraApiClient.getCurrentCsraRating).
   */
  getCurrentRating(username: string, prisonerNumber: string): Promise<CsraCurrentRating> {
    return this.csraApiClient.getCurrentCsraRating(username, { prisonerNumber })
  }
}
