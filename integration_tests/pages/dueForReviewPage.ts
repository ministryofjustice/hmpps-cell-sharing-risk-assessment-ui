import { expect, type Locator, type Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class DueForReviewPage extends AbstractPage {
  readonly table: Locator

  readonly tableRows: Locator

  readonly filterPanel: Locator

  readonly applyButton: Locator

  readonly clearFiltersLink: Locator

  readonly noResultsMessage: Locator

  readonly noDataMessage: Locator

  readonly errorSummary: Locator

  private constructor(page: Page) {
    super(page)
    this.table = page.getByTestId('due-for-review-table')
    this.tableRows = page.getByTestId('due-for-review-table').locator('tbody tr')
    this.filterPanel = page.locator('.moj-filter')
    this.applyButton = page.getByRole('button', { name: 'Apply' })
    this.clearFiltersLink = page.getByRole('link', { name: 'Clear filters' })
    this.noResultsMessage = page.locator('text=No prisoners have been found for the selected filters.')
    this.noDataMessage = page.locator('text=There are no high risk prisoners due for review.')
    this.errorSummary = page.locator('.govuk-error-summary')
  }

  static async verifyOnPage(page: Page): Promise<DueForReviewPage> {
    const dueForReviewPage = new DueForReviewPage(page)
    await expect(page.getByRole('heading', { level: 1, name: 'High risk prisoners due for review' })).toBeVisible()
    return dueForReviewPage
  }
}
