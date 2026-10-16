import { CsraAssessmentStageAnswers, CsraOffenceEvidence, OffenceType } from '../data/csraApiTypes'

const offenceEvidenceTypeToQuestionKeyMap: Record<OffenceType, keyof CsraAssessmentStageAnswers> = {
  MURDER_MANSLAUGHTER: 'offenceMurderManslaughter',
  ASSISTING_SUICIDE: 'offenceAssistingSuicide',
  SEXUAL_ASSAULT: 'offenceSexualAssault',
  REPEATED_VIOLENCE: 'offenceRepeatedViolence',
  PREJUDICE_MOTIVATED: 'offencePrejudiceMotivated',
  ARSON: 'offenceArson',
  KIDNAP_HOSTAGE: 'offenceKidnapHostage',
}

export default function getOffenceEvidenceMap(
  assessmentAnswers: CsraAssessmentStageAnswers,
): Record<string, CsraOffenceEvidence> {
  return Object.fromEntries(
    assessmentAnswers.offenceEvidence.map(evidence => [
      offenceEvidenceTypeToQuestionKeyMap[evidence.offence],
      evidence,
    ]),
  )
}
