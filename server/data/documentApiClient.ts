import superagent from 'superagent'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'

/** Document properties returned by document-api. Only the fields the warrants page needs. */
export interface DocumentMetadata {
  documentUuid: string
  documentFilename: string
  fileExtension: string
  /** Size in bytes. This is the design's "PDF 57.26 KB" — the court API does not carry it. */
  fileSize: number
  mimeType: string
}

export interface DocumentFile {
  body: Buffer
  contentType: string
}

/**
 * Client for hmpps-document-management-api, which stores the warrant PDFs the court API points at.
 *
 * Like PrisonApiClient this does not extend BaseApiClient/RestClient: the file endpoint returns raw
 * binary rather than JSON, and every call needs a Service-Name header that BaseApiClient's apiCall
 * has no way to set. Calls use a system (client-credentials) token stamped with the acting username,
 * as document-api grants ROLE_DOCUMENT_READER to the system client.
 */
export default class DocumentApiClient {
  constructor(private readonly authenticationClient: AuthenticationClient) {}

  private headers(username: string) {
    return {
      // Required on every document-api call: identifies the caller by developer-portal product name.
      'Service-Name': config.apis.documentApi.serviceName,
      // Optional, but it is what puts a real user against the access in document-api's own audit.
      Username: username,
    }
  }

  /**
   * Properties for a batch of documents, in one call.
   *
   * Fetched separately from the court API because file size and mime type live in document-api, not
   * on the hearing payload. Returns [] for an empty UUID list so callers do not have to special-case
   * a prisoner with no warrants.
   */
  async getDocumentsMetadata(username: string, documentUuids: string[]): Promise<DocumentMetadata[]> {
    if (documentUuids.length === 0) return []

    const token = await this.authenticationClient.getToken(username)
    logger.debug(`Getting metadata for ${documentUuids.length} documents from Document API`)
    const response = await superagent
      .post(`${config.apis.documentApi.url}/documents`)
      .auth(token, { type: 'bearer' })
      .set(this.headers(username))
      .send(documentUuids)
      .timeout(config.apis.documentApi.timeout)
    return response.body ?? []
  }

  /**
   * The document file itself.
   *
   * `inline=true` asks document-api for Content-Disposition: inline, which it honours for PDFs, so
   * the browser renders the warrant in its own viewer instead of downloading it. The controller sets
   * the header on our response too, since that is what the browser actually sees.
   */
  async getDocumentFile(username: string, documentUuid: string): Promise<DocumentFile> {
    const token = await this.authenticationClient.getToken(username)
    logger.debug(`Getting file for document ${documentUuid} from Document API`)
    const response = await superagent
      .get(`${config.apis.documentApi.url}/documents/${documentUuid}/file`)
      .query({ inline: true })
      .auth(token, { type: 'bearer' })
      .set(this.headers(username))
      .responseType('blob')
      .timeout(config.apis.documentApi.timeout)
    return { body: response.body, contentType: response.headers['content-type'] ?? 'application/pdf' }
  }
}
