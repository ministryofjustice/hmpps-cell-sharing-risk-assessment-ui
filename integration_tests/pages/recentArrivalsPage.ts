import { expect, type Locator, type Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class RecentArrivalsPage extends AbstractPage {
  readonly filterPanel: Locator

  readonly applyButton: Locator

  private constructor(page: Page) {
    super(page)
    this.filterPanel = page.locator('[data-qa="recent-arrivals-filter"]')
    this.applyButton = page.getByRole('button', { name: 'Apply' })
  }

  static async verifyOnPage(page: Page): Promise<RecentArrivalsPage> {
    const recentArrivalsPage = new RecentArrivalsPage(page)
    await expect(
      page.getByRole('heading', { level: 1, name: 'People who have arrived in the last 3 days' }),
    ).toBeVisible()
    return recentArrivalsPage
  }

  dayHeadings(): Locator {
    return this.page.locator('.csra-recent-arrivals h2')
  }

  tableRowsForDay(dayHeadingText: string): Locator {
    return this.page
      .locator('.csra-recent-arrivals')
      .locator(
        `h2:has-text("${dayHeadingText}") + table tbody tr, h2:has-text("${dayHeadingText}") ~ div + table tbody tr`,
      )
  }

  noPrisonersMessageForDay(dayHeadingText: string): Locator {
    return this.page.locator(`.csra-recent-arrivals h2:has-text("${dayHeadingText}") + p`)
  }
}
