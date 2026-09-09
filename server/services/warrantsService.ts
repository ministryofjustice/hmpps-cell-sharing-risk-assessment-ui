import type { CourtDataApiClient, DocumentApiClient } from '../data'
import type { CourtDocumentType } from '../data/courtDataApiTypes'
import type { DocumentFile } from '../data/documentApiClient'
import logger from '../../logger'

/**
 * The document types CSRA treats as warrants. The court API also ingests prison court registers and
 * generic Common Platform documents, which are not evidence of a current charge and are not shown.
 */
const WARRANT_DOCUMENT_TYPES: CourtDocumentType[] = ['SENTENCING_WARRANT', 'REMAND_WARRANT']

/** How far back the warrants page looks. Named so the spike can flex it without hunting for a literal. */
export const WARRANT_WINDOW_DAYS = 30

const DAY_IN_MS = 24 * 60 * 60 * 1000

export type WarrantSort = 'recent' | 'earliest'

export interface Warrant {
  documentId: string
  documentType: CourtDocumentType
  courtName: string
  hearingType: string
  /** When the document was ingested — the design's "Date added". */
  ingestionAt: string
  /** Size in bytes, or undefined when document-api could not be reached. */
  fileSize?: number
}

export default class WarrantsService {
  constructor(
    private readonly courtDataApiClient: CourtDataApiClient,
    private readonly documentApiClient: DocumentApiClient,
  ) {}

  /**
   * A prisoner's warrants from the last 30 days, newest first by default.
   *
   * Everything except the fetch happens here: the court API takes no query parameters and returns
   * hearings in no particular order, so the warrant-only filter, the date window and the sort are all
   * applied locally.
   *
   * An unmatched prisoner is a normal outcome — roughly 40% of the time, on the Get Court Data team's
   * own figures — so no match returns an empty list rather than throwing.
   */
  async getRecentWarrants(username: string, prisonerNumber: string, sort: WarrantSort = 'recent'): Promise<Warrant[]> {
    const warrants = await this.listWarrants(username, prisonerNumber, sort)
    return this.addFileSizes(username, warrants)
  }

  /**
   * The same warrants without their file sizes.
   *
   * Sizes are only ever rendered on the page, so the callers that just need to know which warrants
   * exist — the task list's check, and the proxy's ownership check — skip the document-api call.
   */
  private async listWarrants(
    username: string,
    prisonerNumber: string,
    sort: WarrantSort = 'recent',
  ): Promise<Warrant[]> {
    const hearings = await this.courtDataApiClient.getCourtHearings(username, { prisonerNumber })

    const cutoff = Date.now() - WARRANT_WINDOW_DAYS * DAY_IN_MS
    const warrants: Warrant[] = (hearings ?? [])
      .flatMap(hearing =>
        hearing.documents
          .filter(document => WARRANT_DOCUMENT_TYPES.includes(document.documentType))
          .map(document => ({
            documentId: document.documentId,
            documentType: document.documentType,
            courtName: hearing.courtName,
            hearingType: hearing.hearingType,
            ingestionAt: document.ingestionAt,
          })),
      )
      .filter(warrant => Date.parse(warrant.ingestionAt) >= cutoff)

    return warrants.sort((a, b) => {
      const difference = Date.parse(a.ingestionAt) - Date.parse(b.ingestionAt)
      return sort === 'earliest' ? difference : -difference
    })
  }

  /**
   * Join file sizes on from document-api, in a single batched call.
   *
   * Deliberately best-effort: a warrant the officer can open still has all its useful information
   * without its size, so a document-api failure drops the sizes rather than the page.
   */
  private async addFileSizes(username: string, warrants: Warrant[]): Promise<Warrant[]> {
    if (warrants.length === 0) return warrants

    try {
      const metadata = await this.documentApiClient.getDocumentsMetadata(
        username,
        warrants.map(warrant => warrant.documentId),
      )
      const sizesByUuid = new Map(metadata.map(document => [document.documentUuid, document.fileSize]))
      return warrants.map(warrant => ({ ...warrant, fileSize: sizesByUuid.get(warrant.documentId) }))
    } catch (error) {
      logger.error('Could not fetch document metadata; rendering warrants without file sizes', error)
      return warrants
    }
  }

  /**
   * Whether a prisoner has any warrant to show, for the task list's evidence panel.
   *
   * Fails soft: the task list is the primary journey and must not break because a downstream spike
   * integration is unavailable or the roles are not yet granted.
   */
  async hasRecentWarrants(username: string, prisonerNumber: string): Promise<boolean> {
    try {
      const warrants = await this.listWarrants(username, prisonerNumber)
      return warrants.length > 0
    } catch (error) {
      logger.error(`Could not check warrants for ${prisonerNumber}; treating as no warrants`, error)
      return false
    }
  }

  /**
   * Fetch one warrant PDF, but only if it is one of the prisoner's own recent warrants.
   *
   * The check is the point: without it the proxy route would fetch any document UUID in the estate
   * for anyone who can open a CSRA. Returns null when the UUID is not one of theirs.
   */
  async getWarrantFile(username: string, prisonerNumber: string, documentId: string): Promise<DocumentFile | null> {
    const warrants = await this.listWarrants(username, prisonerNumber)
    if (!warrants.some(warrant => warrant.documentId === documentId)) {
      logger.warn(`Document ${documentId} is not a recent warrant for ${prisonerNumber}; refusing to fetch`)
      return null
    }
    return this.documentApiClient.getDocumentFile(username, documentId)
  }
}
