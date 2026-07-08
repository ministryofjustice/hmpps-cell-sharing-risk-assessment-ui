import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import BaseApiClient from './baseApiClient'
import { RedisClient } from './redisClient'
import type { Prisoner } from './prisonerSearchApiTypes'

export default class PrisonerSearchApiClient extends BaseApiClient {
  constructor(redisClient: RedisClient, authenticationClient: AuthenticationClient) {
    super('Prisoner Search API', redisClient, config.apis.prisonerSearchApi, authenticationClient)
  }

  /**
   * Look up a single prisoner by prisoner (NOMS) number for the identity banner.
   *
   * Called with a system (client-credentials) token stamped with the acting username, as prisoner-search
   * grants its read role to the system client. Returns 404 if the prisoner number is unknown.
   */
  getPrisoner = this.apiCall<Prisoner, { prisonerNumber: string }>({
    path: '/prisoner/:prisonerNumber',
    requestType: 'get',
    options: { asSystem: true },
  })
}
