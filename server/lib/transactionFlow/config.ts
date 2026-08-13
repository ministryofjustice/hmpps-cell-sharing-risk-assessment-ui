import Step from './step'
import EvidenceCheckboxQuestion from './questionTypes/evidenceCheckbox'
import YesNoQuestion from './questionTypes/yesNo'
import YesNoOffenceSteps from './yesNoOffenceSteps'

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
  ],
}

const conversationAndVulnerability: Section = {
  title: 'Prisoner conversation and vulnerability',
  steps: [],
}

const observation: Section = {
  title: 'Officer observation',
  steps: [],
}

const otherRisks: Section = {
  title: 'Other risk indicators',
  steps: [],
}

const healthcare: Section = {
  title: 'Healthcare assessment',
  steps: [],
}

export default {
  evidenceAndOffences,
  conversationAndVulnerability,
  observation,
  otherRisks,
  healthcare,
} as Record<string, Section>
