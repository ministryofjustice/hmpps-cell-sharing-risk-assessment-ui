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

const ASSESSMENT_ID = 'a1b2c3d4-0000-4000-a000-000000000001'
const TASK_LIST_URL = `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`
const QUESTION_URL = `${TASK_LIST_URL}/section/observation`
const ASSESSMENT_API_URL = `/csra-api/csra-review/prisoner/A1234BC/assessment/${ASSESSMENT_ID}`
const ANSWERS_API_URL = `${ASSESSMENT_API_URL}/stage/PROVISIONAL/answers`

const answers: CsraAssessmentStageAnswers = {
  stage: 'PROVISIONAL',
  prisonId: 'MDI',
  offenceEvidence: [],
  riskTo: [],
  vulnerabilities: [],
  version: 1,
}

const stubSavedAnswers = async (savedAnswers: CsraAssessmentStageAnswers) => {
  const scenarioName = `Save officer observation ${randomUUID()}`
  const assessment: CsraAssessment = {
    assessmentId: ASSESSMENT_ID,
    prisonerNumber: 'A1234BC',
    prisonId: 'MDI',
    status: 'IN_PROGRESS',
    startedBy: 'AUSER_GEN',
    startedAt: '2026-08-06T09:15:00',
    stages: [savedAnswers],
  }
  await stubFor({
    scenarioName,
    requiredScenarioState: 'Started',
    newScenarioState: 'Saved',
    request: { method: 'PUT', url: ANSWERS_API_URL },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: assessment,
    },
  })
  await stubFor({
    priority: 1,
    scenarioName,
    requiredScenarioState: 'Saved',
    request: { method: 'GET', url: ASSESSMENT_API_URL },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: assessment,
    },
  })
}

const savedRequests = async () => {
  const response = await getMatchingRequests({ method: 'PUT', url: ANSWERS_API_URL })
  return response.body.requests as { body: string }[]
}

test.describe('Officer observation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, {
      roles: ['ROLE_CSRA__ASSESSMENT_EDIT'],
      activeCaseLoad: { caseLoadId: 'MDI', description: 'Moorland (HMP)' },
    })
    await csraApi.stubGetInfo(['MDI'])
    await prisonerSearchApi.stubGetPrisoner({
      prisonerNumber: 'A1234BC',
      firstName: 'JOHN',
      lastName: 'SMITH',
      dateOfBirth: '1972-02-03',
      prisonId: 'MDI',
      prisonName: 'Moorland (HMP)',
      cellLocation: 'A-1-001',
    })
    await prisonApi.stubGetPrisonerImage('A1234BC')
    await manageUsersApi.stubGetUserCaseloads(['MDI'])
    await courtDataApi.stubGetCourtHearings('A1234BC', [])
    await csraApi.stubGetAssessment('A1234BC', ASSESSMENT_ID, { stages: [answers] })
    await page.goto(TASK_LIST_URL)
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  test('Back returns from the question to the assessment task list without saving', async ({ page }) => {
    await page.getByRole('link', { name: 'Officer observation', exact: true }).click()

    const backLink = page.getByRole('link', { name: 'Back', exact: true })
    await expect(backLink).toHaveAttribute('href', TASK_LIST_URL)
    await backLink.click()

    await expect(page).toHaveURL(TASK_LIST_URL)
    expect(await savedRequests()).toHaveLength(0)
  })

  test('opens from the task list with the question, mini profile and back link', async ({ page }) => {
    await page.getByRole('link', { name: 'Officer observation', exact: true }).click()

    await expect(page).toHaveURL(QUESTION_URL)
    await expect(page.getByRole('group')).toContainText(
      'Based on observed behaviour, is there any cause for concern about this prisoner sharing a cell?',
    )
    const banner = page.getByTestId('compact-prisoner-banner')
    await expect(banner).toContainText('A1234BC')
    await expect(banner).toContainText('3 February 1972')
    await expect(banner).toContainText('John Smith')
    await page.getByRole('link', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(TASK_LIST_URL)
  })

  test('reveals the bold detail label for Yes and saves the concern details', async ({ page }) => {
    const savedAnswers = {
      ...answers,
      causeForConcernSharing: true,
      causeForConcernSharingDetail: 'Has repeatedly threatened other prisoners.',
    }
    await stubSavedAnswers(savedAnswers)
    await page.getByRole('link', { name: 'Officer observation', exact: true }).click()

    const details = page.getByRole('textbox', { name: 'Provide details of the concern', exact: true })
    await expect(details).toBeHidden()
    await page.getByRole('radio', { name: 'Yes', exact: true }).check()
    await expect(details).toBeVisible()
    await expect(page.locator('label[for="causeForConcernSharingDetail"]')).toHaveCSS('font-weight', '700')
    await details.fill(savedAnswers.causeForConcernSharingDetail)
    await page.getByRole('button', { name: 'Save and return', exact: true }).click()

    await expect(page).toHaveURL(TASK_LIST_URL)
    await expect(page.locator('.govuk-task-list__item').filter({ hasText: 'Officer observation' })).toContainText(
      'Completed',
    )
    const requests = await savedRequests()
    expect(requests).toHaveLength(1)
    expect(JSON.parse(requests[0].body)).toEqual(savedAnswers)
    await page.getByRole('link', { name: 'Officer observation', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Yes', exact: true })).toBeChecked()
    await expect(details).toHaveValue(savedAnswers.causeForConcernSharingDetail)
  })

  test('shows the detail error and does not save when Yes has no details', async ({ page }) => {
    await page.getByRole('link', { name: 'Officer observation', exact: true }).click()
    await page.getByRole('radio', { name: 'Yes', exact: true }).check()
    await page.getByRole('button', { name: 'Save and return', exact: true }).click()

    await expect(page).toHaveURL(QUESTION_URL)
    await expect(page.locator('#causeForConcernSharingDetail-error')).toContainText('Enter details of the concern')
    await expect(page.getByRole('radio', { name: 'Yes', exact: true })).toBeChecked()
    expect(await savedRequests()).toHaveLength(0)
  })

  test('shows the selection error and does not save when neither option is selected', async ({ page }) => {
    await page.getByRole('link', { name: 'Officer observation', exact: true }).click()
    await page.getByRole('button', { name: 'Save and return', exact: true }).click()

    await expect(page).toHaveURL(QUESTION_URL)
    await expect(page.locator('#causeForConcernSharing-error')).toContainText(
      'Select yes if there is any cause for concern about the prisoner sharing a cell',
    )
    expect(await savedRequests()).toHaveLength(0)
  })

  test('saves No and marks the task as completed without requiring details', async ({ page }) => {
    const savedAnswers = { ...answers, causeForConcernSharing: false }
    await stubSavedAnswers(savedAnswers)
    await page.getByRole('link', { name: 'Officer observation', exact: true }).click()
    await page.getByRole('radio', { name: 'No', exact: true }).check()
    await expect(page.getByRole('textbox', { name: 'Provide details of the concern', exact: true })).toBeHidden()
    await page.getByRole('button', { name: 'Save and return', exact: true }).click()

    await expect(page).toHaveURL(TASK_LIST_URL)
    await expect(page.locator('.govuk-task-list__item').filter({ hasText: 'Officer observation' })).toContainText(
      'Completed',
    )
    const requests = await savedRequests()
    expect(requests).toHaveLength(1)
    expect(JSON.parse(requests[0].body)).toEqual(savedAnswers)
    await page.getByRole('link', { name: 'Officer observation', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'No', exact: true })).toBeChecked()
  })

  test('Cancel returns to the task list and discards unsaved changes', async ({ page }) => {
    await page.getByRole('link', { name: 'Officer observation', exact: true }).click()
    await page.getByRole('radio', { name: 'Yes', exact: true }).check()
    await page
      .getByRole('textbox', { name: 'Provide details of the concern', exact: true })
      .fill('Unsaved observation details')
    await page.getByRole('link', { name: 'Cancel', exact: true }).click()

    await expect(page).toHaveURL(TASK_LIST_URL)
    await expect(page.locator('.govuk-task-list__item').filter({ hasText: 'Officer observation' })).toContainText(
      'Not yet started',
    )
    expect(await savedRequests()).toHaveLength(0)
    await page.getByRole('link', { name: 'Officer observation', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Yes', exact: true })).not.toBeChecked()
    await expect(page.getByRole('radio', { name: 'No', exact: true })).not.toBeChecked()
    await page.getByRole('radio', { name: 'Yes', exact: true }).check()
    await expect(page.getByRole('textbox', { name: 'Provide details of the concern', exact: true })).toHaveValue('')
  })
})
