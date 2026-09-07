import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import BaseApiClient from './baseApiClient'
import { RedisClient } from './redisClient'
import type { SplashScreen } from './prisonApiTypes'

/**
 * Prison API client for NOMIS splash screens, used to warn about and then close off the legacy NOMIS
 * CSRA screen as each prison moves to DPS.
 *
 * Separate from PrisonApiClient, which deliberately bypasses RestClient to stream raw image bytes.
 * These are ordinary JSON calls, so they go through BaseApiClient like every other API client.
 *
 * All calls are made with a system (client-credentials) token stamped with the acting username. The
 * system client must hold ROLE_PRISON_API__SPLASH_SCREEN__RO to read and
 * ROLE_PRISON_API__SPLASH_SCREEN__RW to change conditions.
 */
export default class PrisonApiSplashClient extends BaseApiClient {
  constructor(redisClient: RedisClient, authenticationClient: AuthenticationClient) {
    super('PrisonApiSplash', redisClient, config.apis.prisonApi, authenticationClient)
  }

  /** Get a splash screen and its conditions. Rejects with a 404 when the screen is not set up in NOMIS. */
  getSplashScreen = this.apiCall<SplashScreen, { moduleName: string }>({
    path: '/api/splash-screen/:moduleName',
    requestType: 'get',
    options: { asSystem: true },
  })

  addSplashCondition = this.apiCall<
    SplashScreen,
    { moduleName: string },
    { conditionType: string; conditionValue: string; blockAccess: boolean }
  >({
    path: '/api/splash-screen/:moduleName/condition',
    requestType: 'post',
    options: { asSystem: true },
  })

  /** Flip an existing condition between warning and blocked. `blockAccess` is part of the path. */
  updateSplashCondition = this.apiCall<
    SplashScreen,
    { moduleName: string; conditionType: string; conditionValue: string; blockAccess: string }
  >({
    path: '/api/splash-screen/:moduleName/condition/:conditionType/:conditionValue/:blockAccess',
    requestType: 'put',
    options: { asSystem: true },
  })

  removeSplashCondition = this.apiCall<
    Record<string, never>,
    { moduleName: string; conditionType: string; conditionValue: string }
  >({
    path: '/api/splash-screen/:moduleName/condition/:conditionType/:conditionValue',
    requestType: 'delete',
    options: { asSystem: true },
  })
}
