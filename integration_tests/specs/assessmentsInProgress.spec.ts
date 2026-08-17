import { expect, test } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import manageUsersApi from '../mockApis/manageUsersApi'
import { login, resetStubs } from '../testUtils'

test.describe('Assessments in progress', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('renders assessments and resolves staff display names from Manage Users', async ({ page }) => {
    await login(page, {
      activeCaseLoad: { caseLoadId: 'LEI', description: 'Leeds (HMP)' },
      roles: ['ROLE_CSRA__ASSESSMENT_EDIT'],
    })
    await csraApi.stubGetAssessmentsInProgress('LEI')
    await manageUsersApi.stubGetUserDetails('JBLOGGS', 'Joe Bloggs')
    await manageUsersApi.stubGetUserDetails('MSTANLEY', 'Mia Stanley')

    await page.goto('/assessments-in-progress')

    await expect(page.getByRole('heading', { level: 1, name: 'Assessments in progress' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Assessment started (1)' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Provisional rating entered (1)' })).toBeVisible()

    const assessmentStartedTable = page.locator('.csra-assessments-in-progress-table')
    await expect(assessmentStartedTable.locator('tbody tr')).toHaveCount(1)
    await expect(assessmentStartedTable).toContainText('Kettleby, Simon')
    await expect(assessmentStartedTable).toContainText('Joe Bloggs')
    await expect(assessmentStartedTable).toContainText('A9354JF')
    await expect(assessmentStartedTable).toContainText('Continue assessment')

    const provisionalRatingTable = page.locator('.csra-provisional-rating-entered-table')
    await expect(provisionalRatingTable.locator('tbody tr')).toHaveCount(1)
    await expect(provisionalRatingTable).toContainText('Havers, Daniel')
    await expect(provisionalRatingTable).toContainText('Mia Stanley')
    await expect(provisionalRatingTable.locator('.risk-badge')).toContainText('HIGH RISK SPECIFIC')
    await expect(provisionalRatingTable.locator('.risk-badge')).toContainText('(PROVISIONAL)')
    await expect(provisionalRatingTable).toContainText('A5197BD')
    await expect(provisionalRatingTable).toContainText('Continue assessment')
  })

  test('does not show continue assessment buttons when user does not have the role', async ({ page }) => {
    await login(page, { activeCaseLoad: { caseLoadId: 'LEI', description: 'Leeds (HMP)' }, roles: [] })
    await csraApi.stubGetAssessmentsInProgress('LEI')
    await manageUsersApi.stubGetUserDetails('JBLOGGS', 'Joe Bloggs')
    await manageUsersApi.stubGetUserDetails('MSTANLEY', 'Mia Stanley')

    await page.goto('/assessments-in-progress')

    await expect(page.getByRole('heading', { level: 1, name: 'Assessments in progress' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Assessment started (1)' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Provisional rating entered (1)' })).toBeVisible()

    const assessmentStartedTable = page.locator('.csra-assessments-in-progress-table')
    await expect(assessmentStartedTable).not.toContainText('Continue assessment')

    const provisionalRatingTable = page.locator('.csra-provisional-rating-entered-table')
    await expect(provisionalRatingTable).not.toContainText('Continue assessment')
  })

  test('renders empty states when there are no in-progress assessments', async ({ page }) => {
    await login(page, { activeCaseLoad: { caseLoadId: 'LEI', description: 'Leeds (HMP)' } })
    await csraApi.stubGetAssessmentsInProgress('LEI', {
      assessmentStarted: [],
      provisionalRatingEntered: [],
    })

    await page.goto('/assessments-in-progress')

    await expect(page.getByRole('heading', { level: 1, name: 'Assessments in progress' })).toBeVisible()
    await expect(page.getByText('There are no prisoners with an assessment in progress.')).toBeVisible()
    await expect(page.getByText('There are no prisoners with a provisional rating.')).toBeVisible()
  })
})
