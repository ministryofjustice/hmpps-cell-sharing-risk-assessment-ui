/**
 * Types for hmpps-court-data-ingestion-api, which holds court hearings and their documents ingested
 * from Common Platform. Mirrors the API's own DTOs — see its /v3/api-docs.
 */

/**
 * The document types the court API can return. Only the two warrant types are shown in CSRA; the
 * others are ingested for other consumers.
 */
export type CourtDocumentType =
  | 'PRISON_COURT_REGISTER'
  | 'SENTENCING_WARRANT'
  | 'REMAND_WARRANT'
  | 'COMMON_PLATFORM_DOCUMENT'

export interface CourtHearingDocument {
  documentType: CourtDocumentType
  /** UUID of the file in document-api, which is where the PDF itself is fetched from. */
  documentId: string
  /** When the document landed in the court service. This is the design's "Date added". */
  ingestionAt: string
}

export interface CourtHearing {
  hearingId: string
  courtName: string
  courtId: string
  /** The only nullable field on the hearing. */
  courtCode?: string | null
  hearingDate: string
  caseReferences: string[]
  hearingType: string
  documents: CourtHearingDocument[]
}
