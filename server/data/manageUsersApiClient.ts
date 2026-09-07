import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import BaseApiClient from './baseApiClient'
import { RedisClient } from './redisClient'
import type { UserCaseloads, UserDetails } from './manageUsersApiTypes'

const USER_DETAILS_CACHE_DURATION_SECONDS = 60 * 60

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

  /**
   * A single user's details from Manage Users.
   * Called with a system token stamped with the acting username and cached by username.
   */
  getUserDetails = this.apiCall<UserDetails, { username: string }>({
    path: '/users/:username',
    requestType: 'get',
    options: { cacheDuration: USER_DETAILS_CACHE_DURATION_SECONDS, asSystem: true },
  })
}
