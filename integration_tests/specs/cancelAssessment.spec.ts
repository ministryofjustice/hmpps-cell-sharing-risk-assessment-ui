import { expect, test } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import courtDataApi from '../mockApis/courtDataApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import prisonApi from '../mockApis/prisonApi'
import manageUsersApi from '../mockApis/manageUsersApi'
import { getMatchingRequests } from '../mockApis/wiremock'
import { login, resetStubs } from '../testUtils'

const ASSESSMENT_ID = 'a1b2c3d4-0000-4000-a000-000000000002'
const TASK_LIST_URL = `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`
const CANCEL_URL = `${TASK_LIST_URL}/cancel`
const CANCEL_API_URL = `/csra-api/csra-review/prisoner/A1234BC/assessment/${ASSESSMENT_ID}/cancel`

const cancelRequests = async () => {
  const response = await getMatchingRequests({ method: 'POST', url: CANCEL_API_URL })
  return response.body.requests as { body: string }[]
}

test.describe('Cancel assessment', () => {
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
    await csraApi.stubGetAssessment('A1234BC', ASSESSMENT_ID)
    await page.goto(TASK_LIST_URL)
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  test('opens the cancel page from the task list', async ({ page }) => {
    await page.getByRole('link', { name: 'Cancel this assessment', exact: true }).click()

    await expect(page).toHaveURL(CANCEL_URL)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Check answers before you cancel this assessment')
    await expect(page.getByRole('group')).toContainText('Are you sure you want to cancel this assessment?')
  })

  test('Back returns to the task list without cancelling', async ({ page }) => {
    await page.goto(CANCEL_URL)
    await page.getByRole('link', { name: 'Back', exact: true }).click()

    await expect(page).toHaveURL(TASK_LIST_URL)
    expect(await cancelRequests()).toHaveLength(0)
  })

  test('Cancel returns to the task list without cancelling', async ({ page }) => {
    await page.goto(CANCEL_URL)
    await page.getByRole('link', { name: 'Cancel', exact: true }).click()

    await expect(page).toHaveURL(TASK_LIST_URL)
    expect(await cancelRequests()).toHaveLength(0)
  })

  test('shows an error when no option is selected', async ({ page }) => {
    await page.goto(CANCEL_URL)
    await page.getByTestId('cancel-assessment-button').click()

    await expect(page).toHaveURL(CANCEL_URL)
    await expect(page.locator('.govuk-error-summary')).toContainText('Select yes if you want to cancel this assessment')
    expect(await cancelRequests()).toHaveLength(0)
  })

  test('returns to the task list without cancelling when No is selected', async ({ page }) => {
    await page.goto(CANCEL_URL)
    await page.getByRole('radio', { name: 'No' }).check()
    await page.getByTestId('cancel-assessment-button').click()

    await expect(page).toHaveURL(TASK_LIST_URL)
    expect(await cancelRequests()).toHaveLength(0)
  })

  test('cancels the assessment and shows the confirmation page when Yes is selected', async ({ page }) => {
    await csraApi.stubCancelAssessment('A1234BC', ASSESSMENT_ID)

    await page.goto(CANCEL_URL)
    await page.getByRole('radio', { name: 'Yes' }).check()
    await page.getByTestId('cancel-assessment-button').click()

    await expect(page).toHaveURL(`${TASK_LIST_URL}/cancelled`)
    await expect(page.locator('.govuk-panel--confirmation')).toContainText('Assessment cancelled')
    await expect(page.locator('.govuk-panel--confirmation')).toContainText(
      'You have cancelled a cell sharing risk assessment for John Smith',
    )
    await expect(page.getByRole('button', { name: 'Finish' })).toHaveAttribute('href', '/prisoner/A1234BC')

    const requests = await cancelRequests()
    expect(requests).toHaveLength(1)
    expect(JSON.parse(requests[0].body)).toEqual({ prisonId: 'MDI' })
  })

  test('shows the error page when the API refuses the cancellation', async ({ page }) => {
    await csraApi.stubCancelAssessment('A1234BC', ASSESSMENT_ID, 409, {
      status: 409,
      errorCode: 'CsraAssessmentNotCancellable',
    })

    await page.goto(CANCEL_URL)
    await page.getByRole('radio', { name: 'Yes' }).check()
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().endsWith(CANCEL_URL) && res.request().method() === 'POST'),
      page.getByTestId('cancel-assessment-button').click(),
    ])

    expect(response.status()).toBe(409)
    await expect(page).toHaveURL(CANCEL_URL)
    await expect(page.locator('.govuk-panel--confirmation')).toHaveCount(0)
  })
})
