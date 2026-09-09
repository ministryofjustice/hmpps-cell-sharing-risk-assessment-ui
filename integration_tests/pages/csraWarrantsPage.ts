import { expect, type Locator, type Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class CsraWarrantsPage extends AbstractPage {
  readonly heading: Locator

  readonly prisonerBanner: Locator

  readonly intro: Locator

  readonly sort: Locator

  readonly count: Locator

  readonly warrants: Locator

  readonly emptyMessage: Locator

  readonly returnToAssessment: Locator

  private constructor(page: Page) {
    super(page)
    this.heading = page.locator('h1')
    this.prisonerBanner = page.getByTestId('compact-prisoner-banner')
    this.intro = page.getByTestId('warrants-intro')
    this.sort = page.getByTestId('warrants-sort')
    this.count = page.getByTestId('warrants-count')
    this.warrants = page.getByTestId('warrant')
    this.emptyMessage = page.getByTestId('warrants-empty')
    this.returnToAssessment = page.getByTestId('return-to-assessment')
  }

  static async verifyOnPage(page: Page): Promise<CsraWarrantsPage> {
    const warrantsPage = new CsraWarrantsPage(page)
    await expect(warrantsPage.heading).toHaveText('Warrants from the last 30 days')
    return warrantsPage
  }

  /**
   * The warrant rows' link text, in the order they are rendered. Trimmed, as allTextContents keeps
   * the surrounding whitespace from the template that toHaveText would strip.
   */
  async warrantTitles(): Promise<string[]> {
    const titles = await this.warrants.getByTestId('warrant-link').allTextContents()
    return titles.map(title => title.trim())
  }
}
