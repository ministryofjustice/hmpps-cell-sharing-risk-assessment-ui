import { expect, type Locator, type Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class AdminPrisonsPage extends AbstractPage {
  readonly header: Locator

  readonly activeCount: Locator

  readonly prisonsTable: Locator

  readonly successBanner: Locator

  readonly errorBanner: Locator

  readonly nomisUnavailable: Locator

  readonly search: Locator

  readonly searchButton: Locator

  private constructor(page: Page) {
    super(page)
    this.header = page.locator('h1', { hasText: 'Manage enabled prisons' })
    this.activeCount = page.getByTestId('active-count')
    this.prisonsTable = page.getByTestId('prisons-table')
    this.successBanner = page.getByTestId('success-banner')
    this.errorBanner = page.getByTestId('error-banner')
    this.nomisUnavailable = page.getByTestId('nomis-unavailable')
    this.search = page.getByTestId('prison-search')
    this.searchButton = page.getByTestId('prison-search-button')
  }

  static async verifyOnPage(page: Page): Promise<AdminPrisonsPage> {
    const adminPrisonsPage = new AdminPrisonsPage(page)
    await expect(adminPrisonsPage.header).toBeVisible()
    return adminPrisonsPage
  }

  dpsStatus = (agencyId: string): Locator => this.page.getByTestId(`status-${agencyId}`)

  dpsToggle = (agencyId: string): Locator => this.page.getByTestId(`toggle-${agencyId}`)

  nomisStatus = (agencyId: string): Locator => this.page.getByTestId(`nomis-status-${agencyId}`)

  nomisBlock = (agencyId: string): Locator => this.page.getByTestId(`nomis-block-${agencyId}`)

  nomisWarning = (agencyId: string): Locator => this.page.getByTestId(`nomis-warning-${agencyId}`)

  nomisClear = (agencyId: string): Locator => this.page.getByTestId(`nomis-clear-${agencyId}`)
}
