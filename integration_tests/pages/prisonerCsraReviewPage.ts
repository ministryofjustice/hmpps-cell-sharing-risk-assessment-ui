import { expect, type Locator, type Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class PrisonerCsraReviewPage extends AbstractPage {
  readonly heading: Locator

  readonly prisonerBanner: Locator

  readonly rating: Locator

  readonly details: Locator

  readonly questions: Locator

  readonly noQuestions: Locator

  readonly dpsAnswersNote: Locator

  readonly breadcrumbs: Locator

  private constructor(page: Page) {
    super(page)
    this.heading = page.getByTestId('page-heading')
    this.prisonerBanner = page.getByTestId('prisoner-banner')
    this.rating = page.getByTestId('review-rating')
    this.details = page.getByTestId('review-details')
    this.questions = page.getByTestId('review-questions')
    this.noQuestions = page.getByTestId('no-questions')
    this.dpsAnswersNote = page.getByTestId('dps-answers-note')
    this.breadcrumbs = page.locator('.govuk-breadcrumbs')
  }

  static async verifyOnPage(page: Page): Promise<PrisonerCsraReviewPage> {
    const reviewPage = new PrisonerCsraReviewPage(page)
    await expect(reviewPage.heading).toContainText('CSRA review on')
    return reviewPage
  }
}
