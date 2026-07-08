import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import BaseApiClient from './baseApiClient'
import { RedisClient } from './redisClient'
import type { CsraCurrentRating, CsraHistoryQuery, CsraReviewHistory } from './csraApiTypes'

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
}
