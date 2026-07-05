import { PrisonerSearchApiClient } from '../data'
import type { Prisoner } from '../data/prisonerSearchApiTypes'

export default class PrisonerSearchService {
  constructor(private readonly prisonerSearchApiClient: PrisonerSearchApiClient) {}

  /**
   * Look up a prisoner by prisoner (NOMS) number. `username` is stamped onto the system token used for
   * the call (see PrisonerSearchApiClient.getPrisoner).
   */
  getPrisoner(username: string, prisonerNumber: string): Promise<Prisoner> {
    return this.prisonerSearchApiClient.getPrisoner(username, { prisonerNumber })
  }
}
