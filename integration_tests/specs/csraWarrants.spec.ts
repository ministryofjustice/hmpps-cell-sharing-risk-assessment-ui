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

const EDIT_ROLES = ['ROLE_CSRA__ASSESSMENT_EDIT']
const ASSESSMENT_ID = 'a1b2c3d4-0000-4000-a000-000000000001'
const TASK_LIST_URL = `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`
const WARRANTS_URL = `${TASK_LIST_URL}/warrants`
// Reachable before any assessment exists.
const STANDALONE_URL = '/prisoner/A1234BC/warrants'

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
    hearingDate: daysAgo(46),
    caseReferences: ['REF2'],
    hearingType: 'Remand',
    documents: [{ documentType: 'REMAND_WARRANT', documentId: REMAND_DOC, ingestionAt: daysAgo(45) }],
  },
]

const warrantDocumentId = (index: number) => `40000000-0000-4000-8000-${String(index).padStart(12, '0')}`

const hearingsWithWarrants = (count: number): CourtHearing[] =>
  Array.from({ length: count }, (_, index) => ({
    ...hearings()[0],
    hearingId: `hearing-${index}`,
    hearingDate: daysAgo(index / 2 + 1),
    documents: [
      {
        documentType: 'REMAND_WARRANT',
        documentId: warrantDocumentId(index),
        ingestionAt: daysAgo(index / 2 + 1),
      },
    ],
  }))

const stubCommonPageData = async () => {
  await prisonerSearchApi.stubGetPrisoner(prisoner)
  await prisonApi.stubGetPrisonerImage('A1234BC')
  await manageUsersApi.stubGetUserCaseloads(['MDI'])
  await csraApi.stubGetAssessment('A1234BC', ASSESSMENT_ID)
}

const loginAtMoorland = async (page: Parameters<typeof login>[0], roles: string[]) => {
  await csraApi.stubGetInfo(['MDI'])
  await login(page, { roles, activeCaseLoad: { caseLoadId: 'MDI', description: 'Moorland (HMP)' } })
}

test.describe('CSRA court warrants', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('lists recent and older warrants with their court, hearing type, date added and size', async ({ page }) => {
    await loginAtMoorland(page, EDIT_ROLES)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
    await documentApi.stubGetDocumentsMetadata([
      { documentUuid: SENTENCING_DOC, fileSize: 58634 },
      { documentUuid: REMAND_DOC, fileSize: 66765 },
    ])

    await page.goto(WARRANTS_URL)

    const warrantsPage = await CsraWarrantsPage.verifyOnPage(page)
    await expect(warrantsPage.prisonerBanner).toContainText('A1234BC')
    await expect(warrantsPage.intro).toContainText(
      'These are warrants that have been added to DPS from the court system',
    )
    await expect(warrantsPage.intro).toContainText(
      'If you cannot find the warrant you are looking for, check to see if a paper copy is available.',
    )

    // Only the two warrants; the prison court register is filtered out.
    await expect(warrantsPage.warrants).toHaveCount(2)
    await expect(warrantsPage.count).toContainText('Showing 1 to 2 of 2 warrants')
    await expect(warrantsPage.pagination).toHaveCount(0)

    const firstWarrant = warrantsPage.warrants.first()
    await expect(firstWarrant.getByTestId('warrant-link')).toHaveText('Sentencing warrant')
    await expect(firstWarrant.getByTestId('warrant-size')).toHaveText('PDF 57.26 KB')
    await expect(firstWarrant.getByTestId('warrant-court')).toHaveText('Burnley Crown Court')
    await expect(firstWarrant.getByTestId('warrant-hearing-type')).toHaveText('Sentence')
    await expect(firstWarrant.getByTestId('warrant-source')).toHaveText('Common platform')
  })

  test('sorts newest first by default and oldest first on request', async ({ page }) => {
    await loginAtMoorland(page, EDIT_ROLES)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
    await documentApi.stubGetDocumentsMetadata([])

    await page.goto(WARRANTS_URL)
    const warrantsPage = await CsraWarrantsPage.verifyOnPage(page)
    expect(await warrantsPage.warrantTitles()).toEqual(['Sentencing warrant', 'Remand warrant'])

    await page.goto(`${WARRANTS_URL}?sort=earliest`)
    expect(await warrantsPage.warrantTitles()).toEqual(['Remand warrant', 'Sentencing warrant'])
  })

  for (const count of [20, 21]) {
    test(`shows pagination only above twenty results (${count} warrants)`, async ({ page }) => {
      await loginAtMoorland(page, EDIT_ROLES)
      await stubCommonPageData()
      await courtDataApi.stubGetCourtHearings('A1234BC', hearingsWithWarrants(count))
      await documentApi.stubGetDocumentsMetadata([])

      await page.goto(WARRANTS_URL)

      const warrantsPage = await CsraWarrantsPage.verifyOnPage(page)
      await expect(warrantsPage.warrants).toHaveCount(20)
      await expect(warrantsPage.count).toHaveText(`Showing 1 to 20 of ${count} warrants`)
      await expect(warrantsPage.pagination).toHaveCount(count > 20 ? 2 : 0)
    })
  }

  for (const warrantsUrl of [WARRANTS_URL, STANDALONE_URL]) {
    test(`paginates warrants and preserves sorting at ${warrantsUrl}`, async ({ page }) => {
      await loginAtMoorland(page, EDIT_ROLES)
      await stubCommonPageData()
      await courtDataApi.stubGetCourtHearings('A1234BC', hearingsWithWarrants(45))
      await documentApi.stubGetDocumentsMetadata([])

      await page.goto(warrantsUrl)

      const warrantsPage = await CsraWarrantsPage.verifyOnPage(page)
      const topPagination = page.getByRole('navigation', { name: 'Warrants pagination above results', exact: true })
      const bottomPagination = page.getByRole('navigation', { name: 'Warrants pagination below results', exact: true })
      const warrantLinks = warrantsPage.warrants.getByTestId('warrant-link')
      const expectWarrantIds = async (indices: number[]) => {
        await expect(warrantsPage.warrants).toHaveCount(indices.length)
        expect(await warrantLinks.evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(
          indices.map(index => `${warrantsUrl}/${warrantDocumentId(index)}/file`),
        )
      }

      await expect(warrantsPage.pagination).toHaveCount(2)
      await expect(topPagination).toBeVisible()
      await expect(bottomPagination).toBeVisible()
      await expect(page.locator('.govuk-grid-row:has([data-qa="warrants-sort"]) + .govuk-pagination')).toHaveCount(1)
      await expect(page.locator('.csra-warrants + .govuk-pagination')).toHaveCount(1)
      await expect(warrantsPage.count).toHaveText('Showing 1 to 20 of 45 warrants')
      await expectWarrantIds(Array.from({ length: 20 }, (_, i) => i))
      await expect(topPagination.getByRole('link', { name: 'Previous page', exact: true })).toHaveCount(0)

      await topPagination.getByRole('link', { name: 'Next page', exact: true }).click()
      await expect(page).toHaveURL(`${warrantsUrl}?sort=recent&page=2`)
      await expect(warrantsPage.count).toHaveText('Showing 21 to 40 of 45 warrants')
      await expectWarrantIds(Array.from({ length: 20 }, (_, i) => i + 20))
      await expect(topPagination.locator('[aria-current="page"]')).toHaveText('2')
      await expect(bottomPagination.locator('[aria-current="page"]')).toHaveText('2')

      await warrantsPage.sort.getByRole('link', { name: 'Earliest', exact: true }).click()
      await expect(page).toHaveURL(`${warrantsUrl}?sort=earliest`)
      await expect(warrantsPage.count).toHaveText('Showing 1 to 20 of 45 warrants')
      await expectWarrantIds(Array.from({ length: 20 }, (_, i) => 44 - i))

      await bottomPagination.getByRole('link', { name: 'Page 3', exact: true }).click()
      await expect(page).toHaveURL(`${warrantsUrl}?sort=earliest&page=3`)
      await expect(warrantsPage.count).toHaveText('Showing 41 to 45 of 45 warrants')
      await expectWarrantIds([4, 3, 2, 1, 0])
      await expect(topPagination.getByRole('link', { name: 'Next page', exact: true })).toHaveCount(0)
      await expect(bottomPagination.getByRole('link', { name: 'Next page', exact: true })).toHaveCount(0)

      await bottomPagination.getByRole('link', { name: 'Previous page', exact: true }).click()
      await expect(page).toHaveURL(`${warrantsUrl}?sort=earliest&page=2`)
      await expect(warrantsPage.count).toHaveText('Showing 21 to 40 of 45 warrants')
      await expectWarrantIds(Array.from({ length: 20 }, (_, i) => 24 - i))
    })
  }

  test('still lists the warrants when document metadata cannot be fetched, just without sizes', async ({ page }) => {
    await loginAtMoorland(page, EDIT_ROLES)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
    await documentApi.stubGetDocumentsMetadataError()

    await page.goto(WARRANTS_URL)

    const warrantsPage = await CsraWarrantsPage.verifyOnPage(page)
    await expect(warrantsPage.warrants).toHaveCount(2)
    await expect(warrantsPage.warrants.first().getByTestId('warrant-size')).toHaveCount(0)
  })

  test('tells the officer when the prisoner could not be matched on the court system', async ({ page }) => {
    await loginAtMoorland(page, EDIT_ROLES)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearings('A1234BC', [])

    await page.goto(WARRANTS_URL)

    const warrantsPage = await CsraWarrantsPage.verifyOnPage(page)
    await expect(warrantsPage.warrants).toHaveCount(0)
    await expect(warrantsPage.pagination).toHaveCount(0)
    await expect(warrantsPage.emptyMessage).toContainText(
      'Warrant not available in DPS. Check if a paper copy is available.',
    )
  })

  test('serves an older warrant PDF inline so the browser renders it rather than downloading it', async ({ page }) => {
    await loginAtMoorland(page, EDIT_ROLES)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
    await documentApi.stubGetDocumentsMetadata([{ documentUuid: REMAND_DOC, fileSize: 66765 }])
    await documentApi.stubGetDocumentFile(REMAND_DOC)

    const response = await page.request.get(`${WARRANTS_URL}/${REMAND_DOC}/file`)

    expect(response.status()).toEqual(200)
    expect(response.headers()['content-type']).toContain('application/pdf')
    expect(response.headers()['content-disposition']).toEqual('inline')
  })

  test('refuses a document that is not one of the prisoner’s own warrants', async ({ page }) => {
    await loginAtMoorland(page, EDIT_ROLES)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
    await documentApi.stubGetDocumentsMetadata([])
    // Belongs to this prisoner's hearing, but is not a warrant, so it must not be served.
    await documentApi.stubGetDocumentFile(REGISTER_DOC)

    const response = await page.request.get(`${WARRANTS_URL}/${REGISTER_DOC}/file`)

    expect(response.status()).toEqual(404)
  })

  test('links from the task list to the warrants page and back again', async ({ page }) => {
    await loginAtMoorland(page, EDIT_ROLES)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
    await documentApi.stubGetDocumentsMetadata([])

    await page.goto(TASK_LIST_URL)

    // Asserted explicitly: the link has been repointed at a route that does not exist before now,
    // and checking the href names the wrong URL rather than just 404ing on the click.
    const warrantsLink = page.getByRole('link', { name: 'View warrants' })
    await expect(warrantsLink).toHaveAttribute('href', WARRANTS_URL)

    await warrantsLink.click()

    const warrantsPage = await CsraWarrantsPage.verifyOnPage(page)
    await warrantsPage.returnLink.click()

    await expect(page).toHaveURL(new RegExp(`${TASK_LIST_URL}$`))
  })

  test.describe('reached without an assessment id', () => {
    test('a user without the admin role sees the same warrants as the assessment-scoped page', async ({ page }) => {
      await loginAtMoorland(page, EDIT_ROLES)
      await stubCommonPageData()
      await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
      await documentApi.stubGetDocumentsMetadata([
        { documentUuid: SENTENCING_DOC, fileSize: 58634 },
        { documentUuid: REMAND_DOC, fileSize: 66765 },
      ])

      await page.goto(STANDALONE_URL)

      const warrantsPage = await CsraWarrantsPage.verifyOnPage(page)
      await expect(warrantsPage.warrants).toHaveCount(2)
      await expect(warrantsPage.warrants.first().getByTestId('warrant-court')).toHaveText('Burnley Crown Court')
    })

    test('its sort, PDF and return links all stay under the standalone path', async ({ page }) => {
      await loginAtMoorland(page, EDIT_ROLES)
      await stubCommonPageData()
      await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
      await documentApi.stubGetDocumentsMetadata([])

      await page.goto(STANDALONE_URL)

      const warrantsPage = await CsraWarrantsPage.verifyOnPage(page)
      await expect(page.getByRole('link', { name: 'Earliest' })).toHaveAttribute(
        'href',
        `${STANDALONE_URL}?sort=earliest`,
      )
      await expect(warrantsPage.warrants.first().getByTestId('warrant-link')).toHaveAttribute(
        'href',
        `${STANDALONE_URL}/${SENTENCING_DOC}/file`,
      )
      // There is no assessment to return to, so it offers the prisoner's CSRA page instead.
      await expect(warrantsPage.returnLink).toHaveText('Return to CSRA')
      await expect(warrantsPage.returnLink).toHaveAttribute('href', '/prisoner/A1234BC')
    })

    test('serves the warrant PDF inline to a user without the admin role', async ({ page }) => {
      await loginAtMoorland(page, EDIT_ROLES)
      await stubCommonPageData()
      await courtDataApi.stubGetCourtHearings('A1234BC', hearings())
      await documentApi.stubGetDocumentsMetadata([])
      await documentApi.stubGetDocumentFile(SENTENCING_DOC)

      const response = await page.request.get(`${STANDALONE_URL}/${SENTENCING_DOC}/file`)

      expect(response.status()).toEqual(200)
      expect(response.headers()['content-disposition']).toEqual('inline')
    })

    test('still applies the caseload rules', async ({ page }) => {
      await loginAtMoorland(page, EDIT_ROLES)
      await prisonerSearchApi.stubGetPrisoner({ ...prisoner, prisonId: 'LEI', prisonName: 'Leeds (HMP)' })
      await prisonApi.stubGetPrisonerImage('A1234BC')
      await manageUsersApi.stubGetUserCaseloads(['MDI'])
      await csraApi.stubGetAssessment('A1234BC', ASSESSMENT_ID)

      const response = await page.request.get(STANDALONE_URL)

      expect(response.status()).toEqual(404)
    })
  })

  test('shows the no-warrant message on the task list when the court API is unavailable', async ({ page }) => {
    await loginAtMoorland(page, EDIT_ROLES)
    await stubCommonPageData()
    await courtDataApi.stubGetCourtHearingsError('A1234BC')

    await page.goto(TASK_LIST_URL)

    // The task list is the primary journey: a court API outage must not break it.
    await expect(page.locator('h1')).toContainText('CSRA for Daniel Havers')
    await expect(page.getByText('Warrant not available in DPS. Check if a paper copy is available.')).toBeVisible()
  })
})
