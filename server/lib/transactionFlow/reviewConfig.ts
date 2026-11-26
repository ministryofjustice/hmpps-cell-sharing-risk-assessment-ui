import {
  CsraDetailedRating,
  CsraReviewAnswers,
  CsraReviewEvidenceSource,
  CsraReviewReason,
} from '../../data/csraApiTypes'
import RadioQuestion from './questionTypes/radio'
import Step from './step'
import ReviewEvidenceCheckbox from './questionTypes/reviewEvidenceCheckbox'

export const reasonQuestion = new RadioQuestion<CsraReviewAnswers>(
  'What is the reason for the review?',
  'reviewReason',
  [
    {
      text: 'Scheduled long term high risk review',
      hint: 'A routine review for high risk prisoners, carried out at least once a year as part of offender management.',
      value: 'SCHEDULED_LONG_TERM_HIGH_RISK_REVIEW',
    },
    {
      text: 'Short term high risk review',
      hint: 'The person was given a high risk rating due to temporary circumstances, for example due to drug or alcohol withdrawal.',
      value: 'SHORT_TERM_HIGH_RISK_REVIEW',
    },
    {
      text: 'New or additional information',
      hint: 'New information has been identified (for example, PNC, warrant or case notes) that may affect the prisoner’s risk rating.',
      value: 'NEW_OR_ADDITIONAL_INFORMATION',
    },
    {
      text: 'Recent change in behaviour or thinking',
      hint: 'You or others have observed changes that may affect the prisoner’s risk rating (for example, talking to themselves or expressing violent thoughts).',
      value: 'RECENT_CHANGE_IN_BEHAVIOUR_OR_THINKING',
    },
  ],
  {
    insetText: 'Choose the reason for reviewing the prisoner’s cell sharing risk.',
    validationMessages: { required: 'Select the reason for review' },
  },
)

export function availableReviewReasons(rating: CsraDetailedRating): CsraReviewReason[] {
  const allReasons: CsraReviewReason[] = [
    'SCHEDULED_LONG_TERM_HIGH_RISK_REVIEW',
    'SHORT_TERM_HIGH_RISK_REVIEW',
    'NEW_OR_ADDITIONAL_INFORMATION',
    'RECENT_CHANGE_IN_BEHAVIOUR_OR_THINKING',
  ]
  if (rating.inheritedAfterTransfer && (rating.ratingStage === 'PROVISIONAL' || rating.ratingStage === 'INTERIM')) {
    return allReasons
  }
  switch (rating.finalRating ?? rating.provisionalRating) {
    case 'STANDARD':
      return allReasons.slice(2)
    case 'HIGH_GENERAL':
      return allReasons.slice(0, 2)
    case 'HIGH_SPECIFIC':
    case 'HIGH':
      return allReasons
    default:
      return []
  }
}

export const evidenceSources: { value: CsraReviewEvidenceSource; text: string }[] = [
  { value: 'ALLOCATION_BOARD', text: 'Allocation board' },
  { value: 'ASSET_PLUS', text: 'Asset Plus' },
  { value: 'DPS', text: 'DPS' },
  { value: 'HEALTHCARE_ASSESSMENT', text: 'Healthcare assessment' },
  { value: 'INCENTIVES_REVIEW', text: 'Incentives review' },
  { value: 'MAPPA_REVIEW', text: 'MAPPA review' },
  { value: 'INTELLIGENCE_MANAGEMENT_SERVICE', text: 'Intelligence management service' },
  { value: 'OASYS', text: 'OASys' },
  { value: 'PLACEMENT_REVIEW_FORM', text: 'Placement review form' },
  { value: 'PNC', text: 'PNC' },
  { value: 'RECATEGORISATION_REVIEW', text: 'Recategorisation review' },
  { value: 'ROTL_BOARD', text: 'ROTL board' },
  { value: 'SAFETY_AND_SECURITY_FORM', text: 'Safety & security form' },
  { value: 'SAFETY_DIAGNOSTIC_TOOL', text: 'Safety diagnostic tool' },
  { value: 'SECURITY_FILE', text: 'Security file' },
  { value: 'SENTENCE_PLAN', text: 'Sentence plan' },
  { value: 'TRANSFER_CONFIRMATION_FORM', text: 'Transfer confirmation form' },
  { value: 'VIPER', text: 'ViPER' },
  { value: 'OTHER', text: 'Other' },
]

export type ReviewStep = {
  path: string
  persistence: 'stage-reason' | 'pending' | 'create' | 'update'
  step: Step<CsraReviewAnswers>
}

export const reviewSteps: ReviewStep[] = [
  {
    path: 'reason',
    persistence: 'stage-reason',
    step: new Step<CsraReviewAnswers>({ questions: [reasonQuestion], title: 'Review reason' }),
  },
  {
    path: 'scheduled-review',
    persistence: 'pending',
    step: new Step<CsraReviewAnswers>({ questions: [], title: 'Scheduled long term high risk review' }).dependsOn(
      'reviewReason',
      'SCHEDULED_LONG_TERM_HIGH_RISK_REVIEW',
    ),
  },
  {
    path: 'short-term-review',
    persistence: 'pending',
    step: new Step<CsraReviewAnswers>({ questions: [], title: 'Short term high risk review' }).dependsOn(
      'reviewReason',
      'SHORT_TERM_HIGH_RISK_REVIEW',
    ),
  },
  {
    path: 'multidisciplinary-team-review',
    persistence: 'pending',
    step: new Step<CsraReviewAnswers>({ questions: [], title: 'Multidisciplinary team review' }).onlyWhen(answers =>
      ['NEW_OR_ADDITIONAL_INFORMATION', 'RECENT_CHANGE_IN_BEHAVIOUR_OR_THINKING'].includes(answers.reviewReason),
    ),
  },
  {
    path: 'evidence',
    persistence: 'create',
    step: new Step<CsraReviewAnswers>({
      questions: [new ReviewEvidenceCheckbox(evidenceSources)],
      title: 'Evidence sources',
    }),
  },
]
