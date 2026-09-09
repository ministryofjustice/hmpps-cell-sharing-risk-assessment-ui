import { expect, test } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import courtDataApi from '../mockApis/courtDataApi'
import documentApi from '../mockApis/documentApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import prisonApi from '../mockApis/prisonApi'
import manageUsersApi from '../mockApis/manageUsersApi'
import { login, resetStubs } from '../testUtils'
import CsraWarrantsPage from '../pages/csraWarrantsPage'
import type { CourtHearing } from '../../server/data/courtDataApiTypes'

const ASSESSMENT_ID = 'a1b2c3d4-0000-4000-a000-000000000001'
const TASK_LIST_URL = `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`
const WARRANTS_URL = `${TASK_LIST_URL}/warrants`

const SENTENCING_DOC = '11111111-1111-4111-a111-111111111111'
const REMAND_DOC = '22222222-2222-4222-a222-222222222222'
const REGISTER_DOC = '33333333-3333-4333-a333-333333333333'

const prisoner = {
  prisonerNumber: 'A1234BC',
  firstName: 'DANIEL',
  lastName: 'HAVERS',
  dateOfBirth: '1972-02-03',
  pncNumber: '15/17564AG',
  prisonId: 'MDI',
  prisonName: 'Moorland (HMP)',
  cellLocation: 'A-1-001',
}

/** Recent enough to fall inside the 30-day window whenever the suite happens to run. */
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19)

const hearings = (): CourtHearing[] => [
  {
    hearingId: 'hearing-1',
    courtName: 'Burnley Crown Court',
    courtId: 'court-1',
    courtCode: 'B10BU',
    hearingDate: daysAgo(3),
    caseReferences: ['REF1'],
    hearingType: 'Sentence',
    documents: [
      { documentType: 'SENTENCING_WARRANT', documentId: SENTENCING_DOC, ingestionAt: daysAgo(2) },
      // Ingested for other consumers; the warrants page must not show it.
      { documentType: 'PRISON_COURT_REGISTER', documentId: REGISTER_DOC, ingestionAt: daysAgo(2) },
    ],
  },
  {
    hearingId: 'hearing-2',
    courtName: 'Leeds Crown Court',
    courtId: 'court-2',
    courtCode: null,
    hearingDate: daysAgo(9),
    caseReferences: ['REF2'],
    hearingType: 'Remand',
    documents: [{ documentType: 'REMAND_WARRANT', documentId: REMAND_DOC, ingestionAt: daysAgo(8) }],
  },
]

const stubCommonPageData = async () => {
  await prisonerSearchApi.stubGetPrisoner(prisoner)
  await prisonApi.stubGetPrisonerImage('A1234BC')
  await manageUsersApi.stubGetUserCaseloads(['MDI'])
  await csraApi.stubGetAssessment('A1234BC', ASSESSMENT_ID)
}

test.describe('CSRA court warrants', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('lists the prisoner’s warrants with their court, hearing type, date added and size', async ({ page }) => {
    await login(page)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
    await documentApi.stubGetDocumentsMetadata([
      { documentUuid: SENTENCING_DOC, fileSize: 58634 },
      { documentUuid: REMAND_DOC, fileSize: 66765 },
    ])

    await page.goto(WARRANTS_URL)

    const warrantsPage = await CsraWarrantsPage.verifyOnPage(page)
    await expect(warrantsPage.prisonerBanner).toContainText('A1234BC')
    await expect(warrantsPage.intro).toContainText('found by searching the prisoner’s details on the court system')

    // Only the two warrants; the prison court register is filtered out.
    await expect(warrantsPage.warrants).toHaveCount(2)
    await expect(warrantsPage.count).toContainText('Showing 1 to 2 of 2 warrants')

    const firstWarrant = warrantsPage.warrants.first()
    await expect(firstWarrant.getByTestId('warrant-link')).toHaveText('Sentencing warrant')
    await expect(firstWarrant.getByTestId('warrant-size')).toHaveText('PDF 57.26 KB')
    await expect(firstWarrant.getByTestId('warrant-court')).toHaveText('Burnley Crown Court')
    await expect(firstWarrant.getByTestId('warrant-hearing-type')).toHaveText('Sentence')
    await expect(firstWarrant.getByTestId('warrant-source')).toHaveText('Common platform')
  })

  test('sorts newest first by default and oldest first on request', async ({ page }) => {
    await login(page)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
    await documentApi.stubGetDocumentsMetadata([])

    await page.goto(WARRANTS_URL)
    const warrantsPage = await CsraWarrantsPage.verifyOnPage(page)
    expect(await warrantsPage.warrantTitles()).toEqual(['Sentencing warrant', 'Remand warrant'])

    await page.goto(`${WARRANTS_URL}?sort=earliest`)
    expect(await warrantsPage.warrantTitles()).toEqual(['Remand warrant', 'Sentencing warrant'])
  })

  test('still lists the warrants when document metadata cannot be fetched, just without sizes', async ({ page }) => {
    await login(page)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
    await documentApi.stubGetDocumentsMetadataError()

    await page.goto(WARRANTS_URL)

    const warrantsPage = await CsraWarrantsPage.verifyOnPage(page)
    await expect(warrantsPage.warrants).toHaveCount(2)
    await expect(warrantsPage.warrants.first().getByTestId('warrant-size')).toHaveCount(0)
  })

  test('tells the officer when the prisoner could not be matched on the court system', async ({ page }) => {
    await login(page)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearings('A1234BC', [])

    await page.goto(WARRANTS_URL)

    const warrantsPage = await CsraWarrantsPage.verifyOnPage(page)
    await expect(warrantsPage.warrants).toHaveCount(0)
    await expect(warrantsPage.emptyMessage).toContainText('No warrant information could be found for Daniel Havers')
  })

  test('serves the warrant PDF inline so the browser renders it rather than downloading it', async ({ page }) => {
    await login(page)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
    await documentApi.stubGetDocumentsMetadata([{ documentUuid: SENTENCING_DOC, fileSize: 58634 }])
    await documentApi.stubGetDocumentFile(SENTENCING_DOC)

    const response = await page.request.get(`${WARRANTS_URL}/${SENTENCING_DOC}/file`)

    expect(response.status()).toEqual(200)
    expect(response.headers()['content-type']).toContain('application/pdf')
    expect(response.headers()['content-disposition']).toEqual('inline')
  })

  test('refuses a document that is not one of the prisoner’s own warrants', async ({ page }) => {
    await login(page)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
    await documentApi.stubGetDocumentsMetadata([])
    // Belongs to this prisoner's hearing, but is not a warrant, so it must not be served.
    await documentApi.stubGetDocumentFile(REGISTER_DOC)

    const response = await page.request.get(`${WARRANTS_URL}/${REGISTER_DOC}/file`)

    expect(response.status()).toEqual(404)
  })

  test('links from the task list to the warrants page and back again', async ({ page }) => {
    await login(page)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
    await documentApi.stubGetDocumentsMetadata([])

    await page.goto(TASK_LIST_URL)
    await page.getByRole('link', { name: 'View warrants from the last 30 days' }).click()

    const warrantsPage = await CsraWarrantsPage.verifyOnPage(page)
    await warrantsPage.returnToAssessment.click()

    await expect(page).toHaveURL(new RegExp(`${TASK_LIST_URL}$`))
  })

  test('shows the no-warrant message on the task list when the court API is unavailable', async ({ page }) => {
    await login(page)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearingsError('A1234BC')

    await page.goto(TASK_LIST_URL)

    // The task list is the primary journey: a court API outage must not break it.
    await expect(page.locator('h1')).toContainText('CSRA for Daniel Havers')
    await expect(page.getByText('No warrant information could be found for Daniel Havers')).toBeVisible()
  })
})
