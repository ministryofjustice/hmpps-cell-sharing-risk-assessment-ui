import { expect, type Locator, type Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class PrisonerCsraPage extends AbstractPage {
  readonly prisonerName: Locator

  readonly prisonerBanner: Locator

  readonly rating: Locator

  readonly summary: Locator

  readonly riskTo: Locator

  readonly vulnerabilities: Locator

  readonly noCsra: Locator

  readonly assessmentSection: Locator

  readonly reviewSection: Locator

  readonly reviewDueDateSection: Locator

  readonly overdueMessage: Locator

  readonly transferMessage: Locator

  readonly assessmentComment: Locator

  private constructor(page: Page) {
    super(page)
    this.prisonerName = page.getByTestId('prisoner-name')
    this.prisonerBanner = page.getByTestId('prisoner-banner')
    this.rating = page.locator('[data-qa="csra-rating-panel"] .csra-rating-panel__title')
    this.summary = page.getByTestId('csra-rating-panel')
    this.riskTo = page.getByTestId('csra-risk-to')
    this.vulnerabilities = page.getByTestId('csra-vulnerabilities')
    this.noCsra = page.getByTestId('no-csra')
    this.assessmentSection = page.locator('#csra-assessment-section')
    this.reviewSection = page.locator('#csra-review-csra-section')
    this.reviewDueDateSection = page.locator('#csra-review-due-date-section')
    this.overdueMessage = this.reviewDueDateSection.getByText(/days overdue/)
    this.transferMessage = page.locator('.csra-not-complete-text')
    this.assessmentComment = page.locator('#csra-assessment-comment')
  }

  static async verifyOnPage(page: Page, prisonerName: string): Promise<PrisonerCsraPage> {
    const prisonerCsraPage = new PrisonerCsraPage(page)
    await expect(prisonerCsraPage.prisonerName).toHaveText(prisonerName)
    return prisonerCsraPage
  }
}
