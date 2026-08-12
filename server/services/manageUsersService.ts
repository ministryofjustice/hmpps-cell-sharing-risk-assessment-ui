import { ManageUsersApiClient } from '../data'
import type { UserCaseloads, UserDetails } from '../data/manageUsersApiTypes'

export default class ManageUsersService {
  constructor(private readonly manageUsersApiClient: ManageUsersApiClient) {}

  /**
   * The caseloads the signed-in user has access to. Called with the user's own token (see
   * ManageUsersApiClient.getUserCaseloads).
   */
  getUserCaseloads(user: { token: string }): Promise<UserCaseloads> {
    return this.manageUsersApiClient.getUserCaseloads(user.token)
  }

  /**
   * Details for a specific username, called with a system token stamped with the acting username.
   */
  getUserDetails(actingUsername: string, username: string): Promise<UserDetails> {
    return this.manageUsersApiClient.getUserDetails(actingUsername, { username })
  }
}
