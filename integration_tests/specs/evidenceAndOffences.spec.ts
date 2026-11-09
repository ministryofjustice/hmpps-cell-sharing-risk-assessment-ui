import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import courtDataApi from '../mockApis/courtDataApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import prisonApi from '../mockApis/prisonApi'
import manageUsersApi from '../mockApis/manageUsersApi'
import { getMatchingRequests, stubFor } from '../mockApis/wiremock'
import { login, resetStubs } from '../testUtils'
import type { CsraAssessment, CsraAssessmentStageAnswers } from '../../server/data/csraApiTypes'

const ASSESSMENT_ID = 'a1b2c3d4-0000-4000-a000-000000000004'
const TASK_LIST_URL = `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`
const SECTION_URL = `${TASK_LIST_URL}/section/evidenceAndOffences`
const ASSESSMENT_API_URL = `/csra-api/csra-review/prisoner/A1234BC/assessment/${ASSESSMENT_ID}`
const ANSWERS_API_URL = `${ASSESSMENT_API_URL}/stage/FINAL/answers`

const provisional: CsraAssessmentStageAnswers = {
  stage: 'PROVISIONAL',
  prisonId: 'MDI',
  pncChecked: true,
  warrantChecked: true,
  dpsChecked: false,
  perChecked: false,
  offenceMurderManslaughter: true,
  offenceAssistingSuicide: false,
  offenceSexualAssault: false,
  offenceRepeatedViolence: false,
  offencePrejudiceMotivated: false,
  offenceArson: false,
  offenceKidnapHostage: false,
  offenceEvidence: [
    {
      offence: 'MURDER_MANSLAUGHTER',
      sources: ['PNC'],
      otherSourceDetail: null,
      details: 'Recorded provisional evidence',
    },
  ],
  seenByHealthcare: false,
  riskTo: [],
  vulnerabilities: [],
  version: 3,
}

const offencePages = [
  { step: 2, answers: { offenceMurderManslaughter: true, offenceAssistingSuicide: false } },
  { step: 3, answers: { offenceEvidence: provisional.offenceEvidence } },
  { step: 5, answers: { offenceSexualAssault: false } },
  { step: 7, answers: { offenceRepeatedViolence: false } },
  { step: 9, answers: { offencePrejudiceMotivated: false } },
  { step: 11, answers: { offenceArson: false } },
  { step: 13, answers: { offenceKidnapHostage: false } },
]

const stubEvidenceSaves = async () => {
  const initial: CsraAssessment = {
    assessmentId: ASSESSMENT_ID,
    prisonerNumber: 'A1234BC',
    prisonId: 'MDI',
    status: 'IN_PROGRESS',
    startedBy: 'AUSER_GEN',
    startedAt: '2026-07-06T20:00:00',
    interimResult: 'HIGH_GENERAL',
    stages: [provisional],
  }
  const snapshots = [initial]
  const expectedRequests: CsraAssessmentStageAnswers[] = []
  let final: CsraAssessmentStageAnswers = { ...provisional, stage: 'FINAL', version: 1 }
  for (const perChecked of [false, true]) {
    const reset: Partial<CsraAssessmentStageAnswers> = {
      dpsChecked: true,
      perChecked,
      offenceMurderManslaughter: null,
      offenceAssistingSuicide: null,
      offenceSexualAssault: null,
      offenceRepeatedViolence: null,
      offencePrejudiceMotivated: null,
      offenceArson: null,
      offenceKidnapHostage: null,
      offenceEvidence: [],
    }
    for (const changes of [reset, ...offencePages.map(page => page.answers)]) {
      const request = { ...final, ...changes }
      expectedRequests.push(request)
      final = { ...request, version: request.version + 1 }
      snapshots.push({ ...initial, stages: [provisional, final] })
    }
  }

  const scenarioName = `Evidence review ${randomUUID()}`
  await Promise.all(
    snapshots.map((snapshot, index) =>
      stubFor({
        scenarioName,
        requiredScenarioState: index === 0 ? 'Started' : `Saved ${index}`,
        request: { method: 'GET', url: ASSESSMENT_API_URL },
        response: { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: snapshot },
      }),
    ),
  )
  await Promise.all(
    expectedRequests.map((answers, index) =>
      stubFor({
        scenarioName,
        requiredScenarioState: index === 0 ? 'Started' : `Saved ${index}`,
        newScenarioState: `Saved ${index + 1}`,
        request: { method: 'PUT', url: ANSWERS_API_URL, bodyPatterns: [{ equalToJson: answers }] },
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: snapshots[index + 1],
        },
      }),
    ),
  )
  return expectedRequests
}

test.describe('Evidence sources and offences', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('adding each remaining source requires every offence page to be saved again before the task is complete', async ({
    page,
  }) => {
    await login(page, {
      roles: ['ROLE_CSRA__ASSESSMENT_EDIT'],
      activeCaseLoad: { caseLoadId: 'MDI', description: 'Moorland (HMP)' },
    })
    await Promise.all([
      csraApi.stubGetInfo(['MDI']),
      prisonerSearchApi.stubGetPrisoner({
        prisonerNumber: 'A1234BC',
        firstName: 'JOHN',
        lastName: 'SMITH',
        dateOfBirth: '1972-02-03',
        prisonId: 'MDI',
        prisonName: 'Moorland (HMP)',
      }),
      prisonApi.stubGetPrisonerImage('A1234BC'),
      manageUsersApi.stubGetUserCaseloads(['MDI']),
      courtDataApi.stubGetCourtHearings('A1234BC', []),
    ])
    const expectedRequests = await stubEvidenceSaves()
    const task = page.locator('.govuk-task-list__item').filter({ hasText: 'Evidence sources and offences' })
    await page.goto(TASK_LIST_URL)

    /* eslint-disable no-await-in-loop -- Each browser submission depends on the preceding persisted answers. */
    for (const lastSource of [false, true]) {
      await page.getByRole('link', { name: 'Evidence sources and offences', exact: true }).click()
      await expect(page.getByText('Evidence sources already checked', { exact: true })).toBeVisible()
      await page.getByRole('checkbox', { name: 'DPS' }).check()
      if (lastSource) await page.getByRole('checkbox', { name: 'PER' }).check()
      await page.getByRole('button', { name: 'Save and continue', exact: true }).click()
      const saves = await getMatchingRequests({ method: 'PUT', url: ANSWERS_API_URL })
      expect(JSON.parse(saves.body.requests.at(-1).body)).toEqual(expectedRequests[lastSource ? 8 : 0])
      await expect(page).toHaveURL(`${SECTION_URL}/1`)
      await page.getByRole('link', { name: 'Cancel', exact: true }).click()
      await expect(page).toHaveURL(TASK_LIST_URL)
      await expect(task).toContainText('Incomplete')
      await expect(task).not.toContainText('Completed')

      await page.goto(`${SECTION_URL}/1`)
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      for (const { step } of offencePages) {
        await expect(page).toHaveURL(`${SECTION_URL}/${step}`)
        if (step === 3) {
          await expect(page.getByRole('checkbox', { name: 'PNC' })).toBeChecked()
          await expect(page.getByRole('textbox', { name: 'Provide details of the evidence', exact: true })).toHaveValue(
            'Recorded provisional evidence',
          )
        } else {
          const groups = page.getByRole('group')
          const count = await groups.count()
          for (let index = 0; index < count; index += 1) {
            await expect(
              groups.nth(index).getByRole('radio', { name: step === 2 && index === 0 ? 'Yes' : 'No', exact: true }),
            ).toBeChecked()
          }
        }

        // Viewing the page, including pre-populated answers, must not complete the task.
        await page.getByRole('link', { name: 'Cancel', exact: true }).click()
        await expect(page).toHaveURL(TASK_LIST_URL)
        await expect(task).not.toContainText('Completed')
        await page.goto(`${SECTION_URL}/${step}`)
        await page.getByRole('button', { name: 'Save and continue', exact: true }).click()
      }
      await expect(page).toHaveURL(TASK_LIST_URL)
      if (lastSource) {
        await expect(task).toContainText('Completed')
      } else {
        await expect(task).not.toContainText('Completed')
      }
    }
    /* eslint-enable no-await-in-loop */

    const saved = await getMatchingRequests({ method: 'PUT', url: ANSWERS_API_URL })
    const requests = saved.body.requests as { body: string }[]
    expect(requests.map(request => JSON.parse(request.body))).toEqual(expectedRequests)
  })
})
