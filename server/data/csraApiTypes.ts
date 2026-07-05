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
