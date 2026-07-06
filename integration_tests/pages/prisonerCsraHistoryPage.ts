import { expect, type Locator, type Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class PrisonerCsraHistoryPage extends AbstractPage {
  readonly heading: Locator

  readonly prisonerBanner: Locator

  readonly summary: Locator

  readonly totalCsras: Locator

  readonly highCount: Locator

  readonly standardCount: Locator

  readonly reviews: Locator

  readonly filters: Locator

  readonly pagination: Locator

  readonly noResults: Locator

  private constructor(page: Page) {
    super(page)
    this.heading = page.getByTestId('page-heading')
    this.prisonerBanner = page.getByTestId('prisoner-banner')
    this.summary = page.getByTestId('csra-summary')
    this.totalCsras = page.getByTestId('summary-total')
    this.highCount = page.getByTestId('summary-high')
    this.standardCount = page.getByTestId('summary-standard')
    this.reviews = page.getByTestId('csra-review')
    this.filters = page.getByTestId('csra-filters')
    this.pagination = page.getByTestId('pagination').first()
    this.noResults = page.getByTestId('no-results')
  }

  static async verifyOnPage(page: Page): Promise<PrisonerCsraHistoryPage> {
    const historyPage = new PrisonerCsraHistoryPage(page)
    await expect(historyPage.heading).toHaveText('CSRA history')
    return historyPage
  }
}
