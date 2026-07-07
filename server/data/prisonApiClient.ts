import superagent from 'superagent'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'

export interface PrisonerImage {
  body: Buffer
  contentType: string
}

/**
 * Prison API client for the prisoner photo.
 *
 * Unlike the other API clients this does not extend BaseApiClient/RestClient: the image endpoint
 * returns raw binary (image/jpeg), not JSON, so we fetch it with superagent directly and stream the
 * bytes straight through to the browser. Called with a system (client-credentials) token stamped with
 * the acting username, matching the other backend read calls.
 */
export default class PrisonApiClient {
  constructor(private readonly authenticationClient: AuthenticationClient) {}

  async getPrisonerImage(username: string, offenderNo: string): Promise<PrisonerImage> {
    const token = await this.authenticationClient.getToken(username)
    logger.debug(`Getting image for offender ${offenderNo} from Prison API`)
    const response = await superagent
      .get(`${config.apis.prisonApi.url}/api/bookings/offenderNo/${offenderNo}/image/data`)
      .auth(token, { type: 'bearer' })
      .responseType('blob')
      .timeout(config.apis.prisonApi.timeout)
    return { body: response.body, contentType: response.headers['content-type'] ?? 'image/jpeg' }
  }
}
