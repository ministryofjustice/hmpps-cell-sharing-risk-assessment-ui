import { PrisonApiClient } from '../data'
import type { PrisonerImage } from '../data/prisonApiClient'

export default class PrisonApiService {
  constructor(private readonly prisonApiClient: PrisonApiClient) {}

  /**
   * Fetch a prisoner's photo. `username` is stamped onto the system token used for the call
   * (see PrisonApiClient.getPrisonerImage).
   */
  getPrisonerImage(username: string, prisonerNumber: string): Promise<PrisonerImage> {
    return this.prisonApiClient.getPrisonerImage(username, prisonerNumber)
  }
}
