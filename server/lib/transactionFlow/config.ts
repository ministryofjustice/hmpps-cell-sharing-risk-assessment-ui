import Step from './step'
import EvidenceCheckboxQuestion from './questionTypes/evidenceCheckbox'
import YesNoQuestion from './questionTypes/yesNo'
import YesNoOffenceSteps from './yesNoOffenceSteps'
import YesNoWithDetailQuestion from './questionTypes/yesNoWithDetail'
import TextAreaQuestion from './questionTypes/textArea'

const questions = {
  evidenceSources: new EvidenceCheckboxQuestion(),
  offenceMurderManslaughter: new YesNoQuestion(
    'Is there any evidence of murder, manslaughter or a life-threatening assault on another prisoner while in custody?',
    'offenceMurderManslaughter',
  ),
  offenceAssistingSuicide: new YesNoQuestion(
    'Is there any evidence of assisting a suicide while in custody?',
    'offenceAssistingSuicide',
  ),
  offenceSexualAssault: new YesNoQuestion(
    'Is there evidence of sexual assault of a same sex adult victim?',
    'offenceSexualAssault',
    'Either while in custody or in the community.',
  ),
  offenceRepeatedViolence: new YesNoQuestion(
    'Is there evidence of repeated violence in custody?',
    'offenceRepeatedViolence',
  ),
  offencePrejudiceMotivated: new YesNoQuestion(
    'Is there evidence of offending or behaviour motivated by prejudice?',
    'offencePrejudiceMotivated',
    'For example racism, homophobia or religious prejudice.',
  ),
  offenceArson: new YesNoQuestion(
    'Is there evidence of arson or fire setting?',
    'offenceArson',
    'Either while in custody or in the community.',
  ),
  offenceKidnapHostage: new YesNoQuestion(
    'Is there evidence of kidnap, hostage taking and false imprisonment?',
    'offenceKidnapHostage',
    'Either while in custody or in the community.',
  ),
  officerSpokeToPrisoner: new YesNoQuestion(
    'Has an officer spoken with the prisoner about sharing a cell?',
    'officerSpokeToPrisoner',
    'This conversation should give the prisoner an opportunity to express their views or concerns about sharing a cell.',
  ),
  likelyToHarmCellmate: new YesNoWithDetailQuestion(
    'Based on the conversation, is there reason to believe the prisoner is likely to cause harm to someone they share a cell with?',
    'likelyToHarmCellmate',
    'likelyToHarmCellmateDetail',
  ),
  significantlyVulnerable: new YesNoWithDetailQuestion(
    'Is the prisoner significantly vulnerable to assault by others?',
    'significantlyVulnerable',
    'significantlyVulnerableDetail',
  ),
  causeForConcernSharing: new YesNoWithDetailQuestion(
    'Based on observed behaviour, is there any cause for concern about this prisoner sharing a cell?',
    'causeForConcernSharing',
    'causeForConcernSharingDetail',
    'This includes behaviour observed by you or by other officers.',
  ),
  otherHighRiskIndicators: new YesNoWithDetailQuestion(
    'Are there any other indicators to suggest the prisoner is high risk?',
    'otherHighRiskIndicators',
    'otherHighRiskIndicatorsDetail',
  ),
  seenByHealthcare: new YesNoQuestion('Has the prisoner been seen by healthcare?', 'seenByHealthcare'),
  healthcareIncreasedRisk: new YesNoQuestion(
    'Did healthcare identify any signs of increased risk?',
    'healthcareIncreasedRisk',
    'If increased risk has been identified, you must discuss this with healthcare before completing your risk rating.',
    [
      { text: 'No increased risk', value: 'NO' },
      {
        text: 'Yes, the prisoner is an increased risk',
        value: 'YES',
        conditional: new TextAreaQuestion(
          'Provide a brief summary of why healthcare consider the prisoner an increased risk',
          'healthcareIncreasedRiskDetail',
        ),
      },
    ],
  ),
}

const evidenceAndOffences: Section = {
  title: 'Offences',
  steps: [
    new Step({
      title: 'Evidence sources',
      bodyHtml:
        '<p>You must review all evidence sources for any information which may indicate the person is high risk.<br><br>If you are unable to check all sources, you can still submit a provisional CSRA rating.</p>',
      questions: [questions.evidenceSources],
    }),
    ...new YesNoOffenceSteps([
      { question: questions.offenceMurderManslaughter, offenceType: 'MURDER_MANSLAUGHTER' },
      {
        question: questions.offenceAssistingSuicide,
        offenceType: 'ASSISTING_SUICIDE',
      },
    ]).getSteps(),
    ...new YesNoOffenceSteps([{ question: questions.offenceSexualAssault, offenceType: 'SEXUAL_ASSAULT' }]).getSteps(),
    ...new YesNoOffenceSteps([
      { question: questions.offenceRepeatedViolence, offenceType: 'REPEATED_VIOLENCE' },
    ]).getSteps(),
    ...new YesNoOffenceSteps([
      { question: questions.offencePrejudiceMotivated, offenceType: 'PREJUDICE_MOTIVATED' },
    ]).getSteps(),
    ...new YesNoOffenceSteps([{ question: questions.offenceArson, offenceType: 'ARSON' }]).getSteps(),
    ...new YesNoOffenceSteps([{ question: questions.offenceKidnapHostage, offenceType: 'KIDNAP_HOSTAGE' }]).getSteps(),
  ],
}

const conversationAndVulnerability: Section = {
  title: 'Prisoner conversation and vulnerability',
  steps: [
    new Step({
      questions: [questions.officerSpokeToPrisoner],
    }).incompleteUnless('officerSpokeToPrisoner', true),
    new Step({
      questions: [questions.likelyToHarmCellmate],
    }).dependsOn('officerSpokeToPrisoner', true),
    new Step({
      questions: [questions.significantlyVulnerable],
    }).dependsOn('officerSpokeToPrisoner', true),
  ],
}

const observation: Section = {
  title: 'Officer observation',
  steps: [new Step({ questions: [questions.causeForConcernSharing] })],
}

const otherRisks: Section = {
  title: 'Other risk indicators',
  steps: [new Step({ questions: [questions.otherHighRiskIndicators] })],
}

const healthcare: Section = {
  title: 'Healthcare assessment',
  steps: [
    new Step({
      questions: [questions.seenByHealthcare],
    }).incompleteUnless('seenByHealthcare', true),
    new Step({
      questions: [questions.healthcareIncreasedRisk],
    }).dependsOn('seenByHealthcare', true),
  ],
}

export default {
  evidenceAndOffences,
  conversationAndVulnerability,
  observation,
  otherRisks,
  healthcare,
} as Record<string, Section>
