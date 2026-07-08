import { ManageUsersApiClient } from '../data'
import type { UserCaseloads } from '../data/manageUsersApiTypes'

export default class ManageUsersService {
  constructor(private readonly manageUsersApiClient: ManageUsersApiClient) {}

  /**
   * The caseloads the signed-in user has access to. Called with the user's own token (see
   * ManageUsersApiClient.getUserCaseloads).
   */
  getUserCaseloads(user: { token: string }): Promise<UserCaseloads> {
    return this.manageUsersApiClient.getUserCaseloads(user.token)
  }
}
