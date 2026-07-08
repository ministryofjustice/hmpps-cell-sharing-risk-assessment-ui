import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import BaseApiClient from './baseApiClient'
import { RedisClient } from './redisClient'
import type { UserCaseloads } from './manageUsersApiTypes'

export default class ManageUsersApiClient extends BaseApiClient {
  constructor(redisClient: RedisClient, authenticationClient: AuthenticationClient) {
    super('Manage Users API', redisClient, config.apis.manageUsersApi, authenticationClient)
  }

  /**
   * The caseloads (establishments) the signed-in user has access to.
   *
   * This is a "me" endpoint, so it is called with the user's own token (the default, asUser), not a
   * system (client-credentials) token stamped with the username as the backend read APIs use.
   */
  getUserCaseloads = this.apiCall<UserCaseloads, Record<string, never>>({
    path: '/users/me/caseloads',
    requestType: 'get',
  })
}
