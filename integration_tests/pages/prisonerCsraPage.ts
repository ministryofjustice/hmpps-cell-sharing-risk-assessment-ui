import { expect, type Locator, type Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class PrisonerCsraPage extends AbstractPage {
  readonly prisonerName: Locator

  readonly prisonerDetails: Locator

  readonly rating: Locator

  readonly summary: Locator

  readonly riskTo: Locator

  readonly vulnerabilities: Locator

  readonly noCsra: Locator

  private constructor(page: Page) {
    super(page)
    this.prisonerName = page.getByTestId('prisoner-name')
    this.prisonerDetails = page.getByTestId('prisoner-details')
    this.rating = page.getByTestId('csra-rating')
    this.summary = page.getByTestId('csra-summary')
    this.riskTo = page.getByTestId('csra-risk-to')
    this.vulnerabilities = page.getByTestId('csra-vulnerabilities')
    this.noCsra = page.getByTestId('no-csra')
  }

  static async verifyOnPage(page: Page, prisonerName: string): Promise<PrisonerCsraPage> {
    const prisonerCsraPage = new PrisonerCsraPage(page)
    await expect(prisonerCsraPage.prisonerName).toHaveText(prisonerName)
    return prisonerCsraPage
  }
}
