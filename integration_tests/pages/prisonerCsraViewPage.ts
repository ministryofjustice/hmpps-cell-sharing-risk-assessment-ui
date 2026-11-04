import { expect, type Locator, type Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class PrisonerCsraViewPage extends AbstractPage {
  readonly ratingHeading: Locator

  readonly backLink: Locator

  readonly returnButton: Locator

  private constructor(page: Page) {
    super(page)
    this.ratingHeading = page.getByRole('heading', { name: 'Rating and comment' })
    this.backLink = page.locator('.govuk-back-link')
    this.returnButton = page.locator('a.govuk-button')
  }

  static async verifyOnPage(page: Page): Promise<PrisonerCsraViewPage> {
    const viewPage = new PrisonerCsraViewPage(page)
    await expect(viewPage.ratingHeading).toBeVisible()
    return viewPage
  }
}
