import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import BaseApiClient from './baseApiClient'
import { RedisClient } from './redisClient'
import { CellSharingHistory } from './changeSomeonesCellApiTypes'

export default class ChangeSomeonesCellApiClient extends BaseApiClient {
  constructor(redisClient: RedisClient, authenticationClient: AuthenticationClient) {
    super('ChangeSomeonesCellApi', redisClient, config.apis.changeSomeonesCellApi, authenticationClient)
  }

  getCellSharingHistory = this.apiCall<CellSharingHistory, { prisonerNumber: string; from: string; to?: string }>({
    path: '/cell-movements/prisoner/:prisonerNumber/cell-sharing',
    queryParams: ['from', 'to'],
    requestType: 'get',
    options: { asSystem: true },
  })
}
