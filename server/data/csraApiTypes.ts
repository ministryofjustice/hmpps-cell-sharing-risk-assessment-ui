/**
 * Types mirroring the hmpps-cell-sharing-risk-assessment-api response DTOs, hand-written to match the
 * Kotlin models (see CsraCurrentRating.kt, CsraResult.kt, CsraRiskToCategory.kt,
 * CsraVulnerabilityCategory.kt in the API repo). Dates/date-times are ISO-8601 strings over the wire.
 */

/** The outcome of a CSRA review (mirrors jpa.CsraResult). */
export type CsraResult = 'HIGH' | 'HIGH_GENERAL' | 'HIGH_SPECIFIC' | 'STANDARD'

/** The status of a CSRA review (mirrors jpa.CsraReviewStatus). */
export type CsraReviewStatus = 'IN_PROGRESS' | 'COMPLETE' | 'CLOSED' | 'ARCHIVED'

/**
 * A raw NOMIS supervision level (mirrors dto.migration.CsraLevel). Distinct from CsraResult: legacy
 * LOW and MED both collapse to STANDARD in a review's result, so these values exist only to render
 * what the legacy record actually said. PEND is NOMIS's "pending" placeholder.
 */
export type CsraLevel = 'STANDARD' | 'PEND' | 'LOW' | 'MED' | 'HI'

/** What became of a legacy review at approval (mirrors dto.CsraApprovalStatus). */
export type CsraApprovalStatus = 'APPROVED' | 'NOT_APPROVED'

/** A NOMIS committee code (mirrors dto.migration.CsraCommitteeCode). */
export type CsraCommitteeCode = 'GOV' | 'MED' | 'OCA' | 'RECP' | 'REVIEW' | 'SECSTATE' | 'SECUR'

/** The state of a prisoner's current CSRA rating (mirrors dto.CsraRatingStatus). */
export type CsraRatingStatus = 'NO_RATING' | 'IN_PROGRESS' | 'PROVISIONAL' | 'COMPLETE'

/**
 * Which stage the current rating came from. Narrower than the `provisional` boolean, which cannot tell an
 * assessment's Day 1 rating from a review's interim one - the two are badged and sorted differently.
 */
export type CsraRatingStage = 'FINAL' | 'PROVISIONAL' | 'INTERIM'

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

/**
 * The kind of CSRA record (mirrors jpa.CsraType): legacy NOMIS types plus the new DPS ones.
 *
 * MAPA-367 renamed the two that misled: `CSRA_INITIAL_REVIEW` (an assessment, despite the name) became
 * `CSRA_INITIAL_ASSESSMENT`, and the legacy `REVIEW` became `NOMIS_REVIEW` so it cannot be read as the
 * new-model `CSRA_REVIEW`. Both old names are still listed below — see the note there.
 *
 * Prefer `assessmentType` (`CsraAssessmentTypeBucket`) wherever you only need "assessment or review" —
 * it is returned alongside every `type` and needs none of this decoded.
 */
export type CsraReviewType =
  // Legacy NOMIS types, all of which are assessments except NOMIS_REVIEW.
  | 'FULL'
  | 'HEALTH'
  | 'LOCATE'
  | 'RATING'
  | 'RECEPTION'
  | 'NOMIS_REVIEW'
  // New DPS types.
  | 'CSRA_INITIAL_ASSESSMENT'
  | 'CSRA_REVIEW'
  // Pre-MAPA-367 names, kept so this stays correct against an API that has not been deployed yet or
  // has been rolled back. Removable once every environment is past V20.
  | 'REVIEW'
  | 'CSRA_INITIAL_REVIEW'

/**
 * The legacy NOMIS detail carried by a *history row* (mirrors dto.CsraLegacyDetail).
 *
 * NOT the same shape as CsraLegacyReviewDetail below, which is what the *detail* endpoint returns —
 * that one carries the committees, the calculated/approved levels and the question tree as well.
 * Presence of either identifies the record as NOMIS-sourced.
 */
export interface CsraLegacyDetail {
  level?: CsraLevel | null
  assessmentComment?: string | null
  assessmentDate: string
  approvalStatus?: CsraApprovalStatus | null
  approvalComment?: string | null
  approvalCommitteeComment?: string | null
  approvalDate?: string | null
}

/** A single row in a prisoner's CSRA history (mirrors dto.CsraReviewSummary). */
export interface CsraReviewSummary {
  id: string
  type: CsraReviewType
  assessmentType: CsraAssessmentTypeBucket
  rating: CsraResult
  reviewComment?: string | null
  prisonId?: string | null
  prisonName?: string | null
  recordedDate: string
  legacy?: CsraLegacyDetail | null
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

/** A NOMIS committee, with the wording NOMIS displays for it (mirrors dto.CsraCommittee). */
export interface CsraCommittee {
  code: CsraCommitteeCode
  name: string
}

/**
 * A question asked in a legacy NOMIS review and the answer given (mirrors dto.CsraReviewQuestion).
 *
 * `additionalAnswers` holds any further answers to the same question. The API filters out null
 * answers before picking the first, so a question that was answered never arrives with a null
 * `answer` and populated `additionalAnswers`.
 */
export interface CsraReviewQuestion {
  question: string
  answer?: string | null
  additionalAnswers: string[]
}

/**
 * The full legacy NOMIS record behind a migrated review (mirrors dto.CsraLegacyReviewDetail).
 *
 * `approvedResult` is NOMIS's *reviewed* level, which is what it displays as the approved result —
 * its APPROVED_SUP_LEVEL_TYPE column is never populated (MAPA-257).
 */
export interface CsraLegacyReviewDetail {
  level?: CsraLevel | null
  approvalStatus?: CsraApprovalStatus | null
  calculatedResult?: CsraLevel | null
  approvedResult?: CsraLevel | null
  assessmentComment?: string | null
  approvalCommitteeComment?: string | null
  approvalComment?: string | null
  approvalDate?: string | null
  assessmentCommittee?: CsraCommittee | null
  approvalCommittee?: CsraCommittee | null
  nextReviewDate?: string | null
  questions: CsraReviewQuestion[]
}

/** A CSRA review currently in progress for the prisoner. */
export interface CsraInProgress {
  reviewId: string
  type: CsraReviewType
  startedBy?: string | null
  startedAt?: string | null
  prisonId?: string | null
  prisonName?: string | null
}

/**
 * A single CSRA review with everything needed to render its detail page (mirrors dto.CsraReviewDetail).
 *
 * `legacy` is present only for a review migrated from NOMIS, and its presence is what identifies the
 * review as legacy. A DPS-created review has no equivalent block: the answers captured during the
 * assessment are not readable over the API yet.
 */
export interface CsraReviewDetail {
  id: string
  prisonerNumber: string
  prisonId?: string | null
  prisonName?: string | null
  assessmentDate: string
  type: CsraReviewType
  assessmentType: CsraAssessmentTypeBucket
  interimResult?: CsraResult | null
  interimResultDate?: string | null
  finalResult?: CsraResult | null
  finalResultDate?: string | null
  createdAt: string
  createdBy: string
  lastModifiedAt?: string | null
  lastModifiedBy?: string | null
  legacy?: CsraLegacyReviewDetail | null
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
  type?: CsraReviewType | null
  /** Which stage the rating came from; distinguishes a review's interim from an assessment's provisional. */
  ratingStage?: CsraRatingStage | null
  reviewId?: string | null
  prisonId?: string | null
  /** The prison the assessment took place at, falling back to the id when it cannot be resolved. */
  prisonName?: string | null
  assessmentComment?: string | null
  provisionalAssessmentComment?: string | null
  inheritedAfterTransfer?: boolean
  riskTo: CsraRiskToDetail[]
  vulnerabilities: CsraVulnerabilityDetail[]
  provisionalDate?: string | null
  finalDate?: string | null
  nextReviewDate?: string | null
  startedBy?: string | null
  startedAt?: string | null
  inProgress?: CsraInProgress | null
}

/** A started assessment with no provisional/final rating entered yet. */
export interface CsraAssessmentStartedRow {
  reviewId: string
  prisonerNumber: string
  firstName?: string | null
  lastName?: string | null
  startedOn: string
  startedBy: string
}

/** An in-progress assessment where a provisional rating exists and a final rating is still pending. */
export interface CsraProvisionalRatingRow {
  reviewId: string
  prisonerNumber: string
  firstName?: string | null
  lastName?: string | null
  assessedOn: string
  assessedBy: string
  rating: CsraResult
}

/** A prison's in-progress initial assessments split by stage. */
export interface CsraAssessmentsInProgress {
  assessmentStarted: CsraAssessmentStartedRow[]
  provisionalRatingEntered: CsraProvisionalRatingRow[]
}

/** A cell sharing risk review started but not yet completed. */
export interface CsraReviewInProgressRow {
  reviewId: string
  prisonerNumber: string
  firstName?: string | null
  lastName?: string | null
  startedOn: string
  startedBy: string
}

/** A prison's in-progress CSRA reviews. */
export interface CsraReviewsInProgress {
  content: CsraReviewInProgressRow[]
  totalResults: number
}

/** The coarse type of assessment that produced the current rating. */
export type CsraAssessmentTypeBucket = 'ASSESSMENT' | 'REVIEW'

export type EvidenceSource = 'PNC' | 'PER' | 'WARRANT' | 'DPS' | 'OTHER'

export type OffenceType =
  | 'MURDER_MANSLAUGHTER'
  | 'ASSISTING_SUICIDE'
  | 'SEXUAL_ASSAULT'
  | 'REPEATED_VIOLENCE'
  | 'PREJUDICE_MOTIVATED'
  | 'ARSON'
  | 'KIDNAP_HOSTAGE'

export interface CsraAssessment {
  assessmentId: string
  prisonerNumber: string
  prisonId?: string
  status: CsraReviewStatus
  startedBy: string
  startedAt: string
  interimResult?: CsraResult
  finalResult?: CsraResult
  stages: CsraAssessmentStageAnswers[]
}

export interface CsraAssessmentStageAnswers {
  stage: CsraAssessmentStage
  prisonId: string
  lastSavedBy?: string | null
  lastSavedAt?: string | null

  // Evidence sources checked (null = not answered)
  dpsChecked?: boolean | null
  perChecked?: boolean | null
  warrantChecked?: boolean | null
  pncChecked?: boolean | null

  // Offence flags (null = not answered)
  offenceMurderManslaughter?: boolean | null
  offenceAssistingSuicide?: boolean | null
  offenceSexualAssault?: boolean | null
  offenceRepeatedViolence?: boolean | null
  offencePrejudiceMotivated?: boolean | null
  offenceArson?: boolean | null
  offenceKidnapHostage?: boolean | null

  offenceEvidence: CsraOffenceEvidence[]

  // Prisoner conversation and vulnerability (null = not answered)
  officerSpokeToPrisoner?: boolean | null
  likelyToHarmCellmate?: boolean | null
  likelyToHarmCellmateDetail?: string | null
  significantlyVulnerable?: boolean | null
  significantlyVulnerableDetail?: string | null

  // Officer observation / other indicators (null = not answered)
  causeForConcernSharing?: boolean | null
  causeForConcernSharingDetail?: string | null
  otherHighRiskIndicators?: boolean | null
  otherHighRiskIndicatorsDetail?: string | null

  // Healthcare assessment (null = not answered)
  seenByHealthcare?: boolean | null
  healthcareIncreasedRisk?: boolean | null
  healthcareIncreasedRiskDetail?: string | null

  riskTo: CsraRiskToDetail[]
  vulnerabilities: CsraVulnerabilityDetail[]

  version: number
}

export type CsraAssessmentStageRequest = Omit<CsraAssessmentStageAnswers, 'stage' | 'version'> & {
  rating: CsraResult
  assessmentComment: string
}

export type CsraAssessmentStage = 'PROVISIONAL' | 'FINAL'

export interface CsraOffenceEvidence {
  offence: OffenceType
  sources: EvidenceSource[]
  otherSourceDetail?: string | null
  details: string
}

/** A single high-risk prisoner row in the due-for-review list (mirrors dto.CsraHighRiskReviewRow). */
export interface CsraHighRiskReviewRow {
  prisonerNumber: string
  firstName?: string | null
  lastName?: string | null
  reviewDueBy: string
  ratingType: CsraResult
  rating: CsraResult
  provisional: boolean
  /** Which stage the rating came from; distinguishes a review's interim from an assessment's provisional. */
  ratingStage?: CsraRatingStage | null
  lastRatingSource: CsraAssessmentTypeBucket
  lastRatingDate: string
}

/** Optional query params for the high-risk due-for-review endpoint. */
export type CsraHighRiskDueForReviewQuery = {
  ratingTypes?: string[]
  reviewDateFrom?: string
  reviewDateTo?: string
  sort?: string
  direction?: string
}

/** Prison's high-risk prisoners with a due review date (mirrors dto.CsraHighRiskDueForReview). */
export interface CsraHighRiskDueForReview {
  content: CsraHighRiskReviewRow[]
  totalResults: number
  availableRatingTypes: CsraResult[]
}

/** CSRA rating counts for a prison's current population (mirrors dto.CsraPrisonRatingSummary). */
export interface CsraPrisonRatingSummary {
  prisonId: string
  total: number
  noRating: number
  highRisk: number
  standardRisk: number
}

/**
 * A prison (agency) and whether the CSRA service is switched on for it in DPS (mirrors
 * dto.AgencyStatus). Returned by the rollout admin list and by the toggle (which resolves the name
 * too), so one shape serves both.
 */
export interface AgencyStatus {
  agencyId: string
  name: string
  active: boolean
}

/** A single prisoner row in the prison prisoner list (mirrors dto.CsraPrisonPrisoner). */
export interface CsraPrisonPrisoner {
  prisonerNumber: string
  firstName?: string | null
  lastName?: string | null
  /** The current rating (final if present, otherwise interim); null means no rating. */
  rating?: CsraResult | null
  provisional: boolean
  /** Which stage the rating came from; distinguishes a review's interim from an assessment's provisional. */
  ratingStage?: CsraRatingStage | null
  assessmentType?: CsraAssessmentTypeBucket | null
  /** ISO-8601 date the current rating was recorded; null when no rating. */
  assessedOn?: string | null
}

/** A paged list of a prison's current prisoners with their CSRA rating (mirrors dto.CsraPrisonPrisonerList). */
export interface CsraPrisonPrisonerList {
  content: CsraPrisonPrisoner[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

/**
 * Optional query params for the prison prisoners endpoint.
 * A type alias (not an interface) so it carries an implicit index signature and can be spread into the
 * BaseApiClient parameter bag.
 */
export type CsraPrisonPrisonersQuery = {
  page?: number
  size?: number
  sort?: string
  direction?: string
  ratings?: string[]
  assessmentTypes?: string[]
  fromDate?: string
  toDate?: string
}

/** All arrival types as a runtime array — the single source of truth for the union type below. */
export const csraArrivalTypes = ['NEW_ADMISSION', 'TRANSFER_IN', 'COURT_RETURN', 'TEMPORARY_ABSENCE_RETURN'] as const

/** The type of arrival into a prison. */
export type CsraArrivalType = (typeof csraArrivalTypes)[number]

/** A single prisoner who recently arrived at a prison (mirrors dto.CsraArrivalRow). */
export interface CsraArrivalRow {
  prisonerNumber: string
  firstName?: string | null
  lastName?: string | null
  /** ISO-8601 date. */
  dateOfBirth?: string | null
  arrivalType: CsraArrivalType
  /** ISO-8601 date-time. */
  arrivedAt: string
  /** The prisoner's current location — a cell, or a location code such as RECP for reception. */
  location?: string | null
}

/** One calendar day of the window, with the arrivals on that day (mirrors dto.CsraArrivalDay). */
export interface CsraArrivalDay {
  /** ISO-8601 date. */
  date: string
  /** Arrivals on this day matching the filter, latest first; empty when nobody arrived. */
  arrivals: CsraArrivalRow[]
}

/** Recent arrivals at a prison who are still in the establishment (mirrors dto.CsraRecentArrivals). */
export interface CsraRecentArrivals {
  /** One section per calendar day in the window, most recent day first. Every day is present even when empty. */
  days: CsraArrivalDay[]
  totalResults: number
  /** Count of arrivals per type across the whole window (every type always present, zero when none). */
  arrivalTypeCounts: Record<string, number>
  /** ISO-8601 date — the first day of the window (inclusive). */
  fromDate: string
  /** ISO-8601 date — the last day of the window (inclusive, today). */
  toDate: string
}

/**
 * Optional query params for the recent-arrivals endpoint.
 * A type alias (not an interface) so it carries an implicit index signature and can be spread into the
 * BaseApiClient parameter bag.
 */
export type CsraRecentArrivalsQuery = {
  /** Number of days back to include (inclusive of today). Defaults to 3 on the API side. */
  days?: number
  arrivalTypes?: CsraArrivalType[]
}
