/**
 * Types mirroring the hmpps-cell-sharing-risk-assessment-api response DTOs, hand-written to match the
 * Kotlin models (see CsraCurrentRating.kt, CsraResult.kt, CsraRiskToCategory.kt,
 * CsraVulnerabilityCategory.kt in the API repo). Dates/date-times are ISO-8601 strings over the wire.
 */

/** The outcome of a CSRA review (mirrors jpa.CsraResult). */
export type CsraResult = 'HIGH' | 'HIGH_GENERAL' | 'HIGH_SPECIFIC' | 'STANDARD'

/** The state of a prisoner's current CSRA rating (mirrors dto.CsraRatingStatus). */
export type CsraRatingStatus = 'NO_RATING' | 'IN_PROGRESS' | 'PROVISIONAL' | 'COMPLETE'

/** A group a high-risk prisoner may pose a risk to (mirrors jpa.CsraRiskToCategory). */
export type CsraRiskToCategory =
  | 'DIFFERENT_ETHNICITY'
  | 'DIFFERENT_RELIGION'
  | 'DISABLED'
  | 'GANG_MEMBERS'
  | 'SEXUAL_MINORITY'
  | 'OLD_PEOPLE'
  | 'SPECIFIC_PERSONS'
  | 'TRANSGENDER'
  | 'OTHER'
  | 'NONE'

/** A vulnerable or at-risk group a prisoner may belong to (mirrors jpa.CsraVulnerabilityCategory). */
export type CsraVulnerabilityCategory =
  | 'DISABLED'
  | 'SEXUAL_MINORITY'
  | 'MENTAL_HEALTH'
  | 'NEURODIVERSITY'
  | 'OFFENCE_TYPE'
  | 'OLD_PEOPLE'
  | 'TRANSGENDER'
  | 'OTHER'
  | 'NONE'

export interface CsraRiskToDetail {
  category: CsraRiskToCategory
  details?: string | null
}

export interface CsraVulnerabilityDetail {
  category: CsraVulnerabilityCategory
  details?: string | null
}

/** The kind of CSRA record (mirrors jpa.CsraType): legacy NOMIS types plus the new DPS review types. */
export type CsraReviewType =
  | 'FULL'
  | 'HEALTH'
  | 'LOCATE'
  | 'RATING'
  | 'RECEPTION'
  | 'REVIEW'
  | 'CSRA_INITIAL_REVIEW'
  | 'CSRA_REVIEW'

/** A single row in a prisoner's CSRA history (mirrors dto.CsraReviewSummary). */
export interface CsraReviewSummary {
  id: string
  type: CsraReviewType
  rating: CsraResult
  reviewComment?: string | null
  prisonId?: string | null
  recordedDate: string
}

/**
 * Whole-history summary counts (mirrors dto.CsraReviewHistorySummary). Computed over the prisoner's
 * entire history, so these are NOT affected by the list filters.
 */
export interface CsraReviewHistorySummary {
  totalCsras: number
  highCount: number
  standardCount: number
  firstAssessmentDate?: string | null
  lastAssessmentDate?: string | null
  lastHighDate?: string | null
  /**
   * Establishments the prisoner has CSRAs at, for the establishment filter. NOT yet returned by the
   * API — the establishment filter renders only once this is populated (see MAPA-180 follow-up).
   */
  establishments?: { prisonId: string; prisonName: string }[]
}

/** A page of a prisoner's CSRA history plus whole-history summary (mirrors dto.CsraReviewHistory). */
export interface CsraReviewHistory {
  summary: CsraReviewHistorySummary
  content: CsraReviewSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

/**
 * Query parameters for the CSRA history endpoint (already whitelisted/serialised by the route).
 * A type alias (not an interface) so it carries an implicit index signature and can be spread into the
 * BaseApiClient parameter bag.
 */
export type CsraHistoryQuery = {
  page: string
  size: string
  ratings?: string[]
  establishments?: string[]
  fromDate?: string
  toDate?: string
}

/** A prisoner's current CSRA rating and its supporting detail (mirrors dto.CsraCurrentRating). */
export interface CsraCurrentRating {
  prisonerNumber: string
  status: CsraRatingStatus
  rating?: CsraResult | null
  provisional: boolean
  reviewId?: string | null
  prisonId?: string | null
  assessmentComment?: string | null
  provisionalAssessmentComment?: string | null
  riskTo: CsraRiskToDetail[]
  vulnerabilities: CsraVulnerabilityDetail[]
  provisionalDate?: string | null
  finalDate?: string | null
  nextReviewDate?: string | null
  startedBy?: string | null
  startedAt?: string | null
}
