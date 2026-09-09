import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import BaseApiClient from './baseApiClient'
import { RedisClient } from './redisClient'
import type { CourtHearing } from './courtDataApiTypes'

export default class CourtDataApiClient extends BaseApiClient {
  constructor(redisClient: RedisClient, authenticationClient: AuthenticationClient) {
    super('CourtDataIngestionAPI', redisClient, config.apis.courtDataIngestionApi, authenticationClient)
  }

  /**
   * Every court hearing the service holds for a prisoner, each with its documents.
   *
   * Called with a system (client-credentials) token stamped with the acting username: the court API
   * grants ROLE_COURT_DATA_INGESTION__COURT_DATA_RO to the system client, not to end users.
   *
   * The endpoint takes no query parameters — no date range, no paging, no document-type filter — and
   * its underlying query has no ORDER BY, so the 30-day window, the warrant-only filter and the sort
   * are all applied by WarrantsService rather than upstream.
   *
   * Returns an empty array for a prisoner the court service cannot match, which is an expected
   * outcome rather than an error.
   */
  getCourtHearings = this.apiCall<CourtHearing[], { prisonerNumber: string }>({
    path: '/court-hearings/prisoner/:prisonerNumber',
    requestType: 'get',
    options: { asSystem: true },
  })
}
