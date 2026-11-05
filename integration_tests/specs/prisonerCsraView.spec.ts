import { expect, type Page, test } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import prisonApi from '../mockApis/prisonApi'
import manageUsersApi from '../mockApis/manageUsersApi'
import { login, resetStubs } from '../testUtils'
import PrisonerCsraViewPage from '../pages/prisonerCsraViewPage'
import PrisonerCsraHistoryPage from '../pages/prisonerCsraHistoryPage'

const prisoner = {
  prisonerNumber: 'A5197BD',
  firstName: 'DANIEL',
  lastName: 'HAVERS',
  dateOfBirth: '1972-02-03',
  pncNumber: '15/17564AG',
  prisonId: 'LEI',
  prisonName: 'Leeds (HMP)',
  cellLocation: 'A-1-001',
}

const assessmentId = 'de91dfa7-821f-4552-a427-bf2f32eafeb0'

const stubViewPage = async (page: Page, detailedRating: Parameters<typeof csraApi.stubGetDetailedRating>[1] = {}) => {
  await login(page, {
    roles: ['ROLE_CSRA__ASSESSMENT_EDIT'],
    activeCaseLoad: { caseLoadId: prisoner.prisonId, description: prisoner.prisonName },
  })
  await csraApi.stubGetInfo(['LEI'])
  await prisonerSearchApi.stubGetPrisoner(prisoner)
  await prisonApi.stubGetPrisonerImage(prisoner.prisonerNumber)
  await manageUsersApi.stubGetUserCaseloads(['LEI'])
  await csraApi.stubGetAssessment(prisoner.prisonerNumber, assessmentId, {
    status: 'COMPLETE',
    stages: [
      {
        stage: 'FINAL',
        prisonId: 'LEI',
        version: 1,
        offenceEvidence: [],
        riskTo: [],
        vulnerabilities: [],
      },
    ],
  })
  await csraApi.stubGetDetailedRating(assessmentId, {
    prisonerNumber: prisoner.prisonerNumber,
    status: 'COMPLETE',
    rating: 'HIGH_SPECIFIC',
    provisional: false,
    ...detailedRating,
  })
}

test.describe('Prisoner CSRA view', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('shows the rating and links back to the CSRA overview', async ({ page }) => {
    await stubViewPage(page)

    await page.goto(`/prisoner/${prisoner.prisonerNumber}/csra/${assessmentId}/view`)

    const viewPage = await PrisonerCsraViewPage.verifyOnPage(page)
    await expect(page.getByText('High risk – specific', { exact: true })).toBeVisible()
    await expect(viewPage.returnButton).toHaveText('Return to CSRA overview')
    await viewPage.returnButton.click()
    await expect(page).toHaveURL(`/prisoner/${prisoner.prisonerNumber}`)
  })

  test('returns to CSRA history when reached from the history page', async ({ page }) => {
    await stubViewPage(page)
    await csraApi.stubGetCsraHistory(prisoner.prisonerNumber, {
      summary: {
        totalCsras: 1,
        highCount: 1,
        standardCount: 0,
        firstAssessmentDate: '2024-07-23',
        lastAssessmentDate: '2024-07-23',
        lastHighDate: '2024-07-23',
        ratings: ['HIGH_SPECIFIC'],
        establishments: [{ prisonId: 'LEI', prisonName: 'Leeds (HMP)' }],
      },
      content: [
        {
          id: assessmentId,
          type: 'CSRA_REVIEW',
          assessmentType: 'REVIEW',
          rating: 'HIGH_SPECIFIC',
          reviewComment: 'Cannot share with specific groups.',
          recordedDate: '2024-07-23',
          finalRating: 'HIGH_SPECIFIC',
          finalReviewComment: 'Cannot share with specific groups.',
          finalRecordedDate: '2024-07-23',
          finalPrisonId: 'LEI',
          finalPrisonName: 'Leeds (HMP)',
          provisionalRating: null,
          provisionalRecordedDate: null,
          provisionalPrisonId: null,
          provisionalPrisonName: null,
          interimReviewer: null,
          closureReason: null,
          riskTo: [],
          vulnerabilities: [],
          prisonId: 'LEI',
          prisonName: 'Leeds (HMP)',
        },
      ],
      totalElements: 1,
      totalPages: 1,
    })

    await page.goto(`/prisoner/${prisoner.prisonerNumber}/history`)
    await PrisonerCsraHistoryPage.verifyOnPage(page)
    await page.getByTestId('view-full-link').first().click()

    await expect(page).toHaveURL(`/prisoner/${prisoner.prisonerNumber}/csra/${assessmentId}/view?referrer=history`)
    const viewPage = await PrisonerCsraViewPage.verifyOnPage(page)
    await expect(viewPage.returnButton).toHaveText('Return to CSRA history')
    await viewPage.returnButton.click()
    await expect(page).toHaveURL(`/prisoner/${prisoner.prisonerNumber}/history`)
  })

  test('does not show a rating that belongs to another prisoner', async ({ page }) => {
    await stubViewPage(page, { prisonerNumber: 'A9354JF' })

    const response = await page.goto(`/prisoner/${prisoner.prisonerNumber}/csra/${assessmentId}/view`)

    expect(response?.status()).toBe(404)
  })
})
