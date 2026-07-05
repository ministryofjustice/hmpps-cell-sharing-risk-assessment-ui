import { expect, test } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import { login, resetStubs } from '../testUtils'
import PrisonerCsraPage from '../pages/prisonerCsraPage'

const prisoner = {
  prisonerNumber: 'A1234BC',
  firstName: 'JOHN',
  lastName: 'SMITH',
  prisonId: 'MDI',
  prisonName: 'Moorland (HMP)',
  cellLocation: 'A-1-001',
}

test.describe('Prisoner CSRA', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('shows the current CSRA rating and supporting detail for a prisoner', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await csraApi.stubGetCurrentRating('A1234BC', {
      status: 'COMPLETE',
      rating: 'HIGH_SPECIFIC',
      provisional: false,
      assessmentComment: 'PNC checked. No issues found.',
      riskTo: [{ category: 'DIFFERENT_ETHNICITY', details: 'Racist towards other ethnicities.' }],
      vulnerabilities: [{ category: 'NEURODIVERSITY', details: null }],
      finalDate: '2026-07-01',
      nextReviewDate: '2027-05-06',
    })

    await page.goto('/prisoner/A1234BC')

    const prisonerCsraPage = await PrisonerCsraPage.verifyOnPage(page, 'John Smith')
    await expect(prisonerCsraPage.prisonerDetails).toContainText('A1234BC')
    await expect(prisonerCsraPage.prisonerDetails).toContainText('Moorland (HMP)')
    await expect(prisonerCsraPage.prisonerDetails).toContainText('A-1-001')
    await expect(prisonerCsraPage.rating).toHaveText('High risk – specific')
    await expect(prisonerCsraPage.summary).toContainText('PNC checked. No issues found.')
    await expect(prisonerCsraPage.summary).toContainText('1 July 2026')
    await expect(prisonerCsraPage.summary).toContainText('6 May 2027')
    await expect(prisonerCsraPage.riskTo).toContainText('Different ethnicity')
    await expect(prisonerCsraPage.vulnerabilities).toContainText('Neurodiversity')
  })

  test('shows a no-CSRA message when the prisoner has no current rating', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await csraApi.stubGetCurrentRating('A1234BC', { status: 'NO_RATING', rating: null })

    await page.goto('/prisoner/A1234BC')

    const prisonerCsraPage = await PrisonerCsraPage.verifyOnPage(page, 'John Smith')
    await expect(prisonerCsraPage.noCsra).toContainText('does not have a current CSRA')
  })
})
