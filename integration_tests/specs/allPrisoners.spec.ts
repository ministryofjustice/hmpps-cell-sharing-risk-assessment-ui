import { expect, test } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import { login, resetStubs } from '../testUtils'
import { getMatchingRequests } from '../mockApis/wiremock'
import type { CsraPrisonPrisonerList } from '../../server/data/csraApiTypes'

const MDI = { caseLoadId: 'MDI', description: 'Moorland (HMP)' }

const onePagePrisoners: CsraPrisonPrisonerList = {
  content: [
    {
      prisonerNumber: 'A1049JF',
      firstName: 'CALLUM',
      lastName: 'REID',
      rating: 'HIGH_GENERAL',
      provisional: false,
      assessmentType: 'ASSESSMENT',
      assessedOn: '2026-03-05',
    },
  ],
  page: 0,
  size: 25,
  totalElements: 1,
  totalPages: 1,
}

const twoPagePrisoners: CsraPrisonPrisonerList = {
  content: [
    {
      prisonerNumber: 'A1049JF',
      firstName: 'CALLUM',
      lastName: 'REID',
      rating: 'HIGH_GENERAL',
      provisional: false,
      assessmentType: 'ASSESSMENT',
      assessedOn: '2026-03-05',
    },
    {
      prisonerNumber: 'A5197BD',
      firstName: 'DANIEL',
      lastName: 'HAVERS',
      rating: 'STANDARD',
      provisional: false,
      assessmentType: 'REVIEW',
      assessedOn: '2026-03-12',
    },
  ],
  page: 1,
  size: 25,
  totalElements: 26,
  totalPages: 2,
}

test.describe('All prisoners', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('renders the table and hides pagination when there is only one page', async ({ page }) => {
    await login(page, { activeCaseLoad: MDI })
    await csraApi.stubGetPrisonPrisoners('MDI', onePagePrisoners)

    await page.goto('/all-prisoners')

    await expect(page.getByRole('heading', { level: 1, name: 'CSRA ratings for all prisoners' })).toBeVisible()
    await expect(page.locator('[data-qa="all-prisoners-filter"]')).toBeVisible()
    await expect(page.locator('[data-qa="all-prisoners-table"] tbody tr')).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Reid, Callum' })).toBeVisible()
    await expect(page.locator('.govuk-pagination')).toHaveCount(0)
    await expect(page.locator('.pagination-results-summary')).toHaveCount(0)
  })

  test('renders pagination and the results summary when there is more than one page', async ({ page }) => {
    await login(page, { activeCaseLoad: MDI })
    await csraApi.stubGetPrisonPrisoners('MDI', twoPagePrisoners)

    await page.goto('/all-prisoners?page=2')

    await expect(page.getByRole('heading', { level: 1, name: 'CSRA ratings for all prisoners' })).toBeVisible()
    await expect(page.locator('[data-qa="all-prisoners-table"] tbody tr')).toHaveCount(2)
    await expect(page.locator('.govuk-pagination')).toHaveCount(2)
    await expect(page.locator('.pagination-results-summary')).toHaveCount(2)
    await expect(page.locator('.pagination-results-summary').first()).toContainText('Showing 26 to 26 of 26 prisoners')
  })

  test('renders the filter panel with checkboxes for available rating and assessment types', async ({ page }) => {
    await login(page, { activeCaseLoad: MDI })
    await csraApi.stubGetPrisonPrisoners('MDI', onePagePrisoners)

    await page.goto('/all-prisoners')

    await expect(page.locator('[data-qa="all-prisoners-filter"]')).toBeVisible()
    await expect(page.getByLabel('High risk – general')).toBeVisible()
    await expect(page.getByLabel('High risk – specific')).toBeVisible()
    await expect(page.getByLabel('Standard')).toBeVisible()
    await expect(page.getByLabel('No rating')).toBeVisible()
    await expect(page.getByLabel('Assessment')).toBeVisible()
    await expect(page.getByLabel('Review')).toBeVisible()
    await expect(page.getByLabel('Date from')).toBeVisible()
    await expect(page.getByLabel('Date to')).toBeVisible()
  })

  test('submits selected filter values in the URL when Apply is clicked', async ({ page }) => {
    await login(page, { activeCaseLoad: MDI })
    await csraApi.stubGetPrisonPrisoners('MDI', onePagePrisoners)

    await page.goto('/all-prisoners')

    await page.getByLabel('High risk – general').check()
    await page.getByLabel('Review').check()
    await page.getByLabel('Date from').fill('1/8/2026')
    await page.getByLabel('Date to').fill('31/8/2026')
    await page.getByRole('button', { name: 'Apply' }).click()

    await expect(page).toHaveURL(/rating=HIGH_GENERAL/)
    await expect(page).toHaveURL(/assessmentType=REVIEW/)
    await expect(page).toHaveURL(/assessmentDateFrom=1%2F8%2F2026/)
    await expect(page).toHaveURL(/assessmentDateTo=31%2F8%2F2026/)
  })

  test('sort links request a freshly sorted result set from the server and preserve filters', async ({ page }) => {
    await login(page, { activeCaseLoad: MDI })
    await csraApi.stubGetPrisonPrisoners('MDI', twoPagePrisoners)

    await page.goto('/all-prisoners?rating=HIGH&rating=STANDARD&assessmentType=REVIEW')

    await expect(page.locator('[data-qa="all-prisoners-table"]')).not.toHaveAttribute(
      'data-module',
      'moj-sortable-table',
    )
    await expect(page.locator('th[aria-sort="none"]').filter({ hasText: 'Name' }).locator('svg path')).toHaveCount(2)

    await page.getByRole('link', { name: 'Name' }).click()

    await expect(page).toHaveURL(/sort=NAME/)
    await expect(page).toHaveURL(/direction=ASC/)
    await expect(page).toHaveURL(/rating=HIGH/)
    await expect(page).toHaveURL(/rating=STANDARD/)
    await expect(page).toHaveURL(/assessmentType=REVIEW/)
    await expect(page.locator('th[aria-sort="ascending"]').filter({ hasText: 'Name' }).locator('svg path')).toHaveCount(
      1,
    )

    const matchingRequests = await getMatchingRequests({
      method: 'GET',
      urlPath: '/csra-api/csra-review/prison/MDI/prisoners',
    })
    const { requests } = matchingRequests.body
    const lastRequest = requests[requests.length - 1]

    expect(lastRequest.queryParams.sort.values[0]).toBe('NAME')
    expect(lastRequest.queryParams.direction.values[0]).toBe('ASC')
    expect(lastRequest.queryParams.assessmentTypes.values[0]).toBe('REVIEW')
    expect(lastRequest.queryParams.ratings.values).toEqual(expect.arrayContaining(['HIGH', 'STANDARD']))
  })

  test('restores checked filter values after filter submission', async ({ page }) => {
    await login(page, { activeCaseLoad: MDI })
    await csraApi.stubGetPrisonPrisoners('MDI', onePagePrisoners)

    await page.goto(
      '/all-prisoners?rating=HIGH_GENERAL&assessmentType=REVIEW&assessmentDateFrom=1%2F8%2F2026&assessmentDateTo=31%2F8%2F2026',
    )

    await expect(page.getByLabel('High risk – general')).toBeChecked()
    await expect(page.getByLabel('Review')).toBeChecked()
    await expect(page.getByLabel('High risk – specific')).not.toBeChecked()
    await expect(page.getByLabel('Assessment')).not.toBeChecked()
    await expect(page.getByLabel('Date from')).toHaveValue('1/8/2026')
    await expect(page.getByLabel('Date to')).toHaveValue('31/8/2026')
  })

  test('shows no-results guidance when filtered results are empty', async ({ page }) => {
    await login(page, { activeCaseLoad: MDI })
    await csraApi.stubGetPrisonPrisoners('MDI', {
      content: [],
      page: 0,
      size: 25,
      totalElements: 0,
      totalPages: 0,
    })

    await page.goto('/all-prisoners?rating=HIGH_GENERAL')

    await expect(page.getByText('No prisoners have been found for the selected filters.')).toBeVisible()
    await expect(page.locator('[data-qa="all-prisoners-filter"]')).toBeVisible()
    await expect(page.getByText('select different CSRA rating types')).toBeVisible()
  })

  test('shows validation errors for invalid date inputs', async ({ page }) => {
    await login(page, { activeCaseLoad: MDI })
    await csraApi.stubGetPrisonPrisoners('MDI', onePagePrisoners)

    await page.goto('/all-prisoners?assessmentDateFrom=31%2F4%2Fabcd&assessmentDateTo=zzxxyy')

    await expect(page.locator('.govuk-error-summary')).toBeVisible()
    await expect(page.locator('.govuk-error-summary')).toContainText('There is a problem')
    await expect(
      page.locator('.govuk-error-summary').getByRole('link', {
        name: "'Assessment date from' must be a date in the correct format, for example, 17/5/2024",
      }),
    ).toBeVisible()
    await expect(
      page.locator('.govuk-error-summary').getByRole('link', {
        name: "'Assessment date to' must be a date in the correct format, for example, 17/5/2024",
      }),
    ).toBeVisible()
    await expect(
      page.locator('#assessmentDateFrom').locator('xpath=ancestor::*[contains(@class,"govuk-form-group")][1]'),
    ).toContainText("'Assessment date from' must be a date in the correct format, for example, 17/5/2024")
    await expect(
      page.locator('#assessmentDateTo').locator('xpath=ancestor::*[contains(@class,"govuk-form-group")][1]'),
    ).toContainText("'Assessment date to' must be a date in the correct format, for example, 17/5/2024")
  })

  test('clear filters link navigates back to the unfiltered page', async ({ page }) => {
    await login(page, { activeCaseLoad: MDI })
    await csraApi.stubGetPrisonPrisoners('MDI', onePagePrisoners)

    await page.goto('/all-prisoners?rating=HIGH_GENERAL')

    await page.getByRole('link', { name: 'Clear filters' }).click()

    await expect(page).toHaveURL('/all-prisoners')
  })
})
