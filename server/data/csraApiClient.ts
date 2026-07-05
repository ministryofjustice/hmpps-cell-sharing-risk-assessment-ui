import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import BaseApiClient from './baseApiClient'
import { RedisClient } from './redisClient'
import type { CsraCurrentRating } from './csraApiTypes'

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
}
