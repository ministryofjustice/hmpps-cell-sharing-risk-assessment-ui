import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import BaseApiClient from './baseApiClient'
import { RedisClient } from './redisClient'
import type { AgencyDetails } from './prisonApiTypes'

/**
 * Prison API client for NOMIS agency switches (the SERVICE_AGENCY_SWITCHES table), used to tell NOMIS
 * which prisons have moved to DPS for CSRA and which no longer have a NOMIS approval step.
 *
 * Prison API behaviour the callers rely on: a service code missing from EXTERNAL_SERVICES is a 404,
 * adding an agency that is already switched on is a 409, and removing one that is not is a 204.
 *
 * All calls are made with a system (client-credentials) token stamped with the acting username. The
 * system client must hold ROLE_PRISON_API__SERVICE_AGENCY_SWITCHES__RW, which covers reads too. That
 * role is not limited to CSRA: it lets the client change any service's switches.
 */
export default class PrisonApiAgencySwitchClient extends BaseApiClient {
  constructor(redisClient: RedisClient, authenticationClient: AuthenticationClient) {
    super('PrisonApiAgencySwitch', redisClient, config.apis.prisonApi, authenticationClient)
  }

  /** The agencies switched on for a service. `*ALL*` means every agency. */
  getAgencySwitches = this.apiCall<AgencyDetails[], { serviceCode: string }>({
    path: '/api/agency-switches/:serviceCode',
    requestType: 'get',
    options: { asSystem: true },
  })

  addAgencySwitch = this.apiCall<AgencyDetails, { serviceCode: string; agencyId: string }>({
    path: '/api/agency-switches/:serviceCode/agency/:agencyId',
    requestType: 'post',
    options: { asSystem: true },
  })

  removeAgencySwitch = this.apiCall<Record<string, never>, { serviceCode: string; agencyId: string }>({
    path: '/api/agency-switches/:serviceCode/agency/:agencyId',
    requestType: 'delete',
    options: { asSystem: true },
  })
}
