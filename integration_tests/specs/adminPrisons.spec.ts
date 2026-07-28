import { expect, test } from '@playwright/test'
import { login, resetStubs } from '../testUtils'
import AdminPrisonsPage from '../pages/adminPrisonsPage'
import csraApi from '../mockApis/csraApi'
import prisonApi from '../mockApis/prisonApi'

const ADMIN_ROLES = ['ROLE_CSRA__ADMIN']

const AGENCIES = [
  { agencyId: 'LEI', name: 'Leeds (HMP)', active: false },
  { agencyId: 'MDI', name: 'Moorland (HMP)', active: true },
]

test.describe('Admin - manage enabled prisons', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('lists every prison with its DPS and NOMIS state', async ({ page }) => {
    await login(page, { roles: ADMIN_ROLES })
    await csraApi.stubGetAllAgencies(AGENCIES)
    await prisonApi.stubGetSplashScreen([{ conditionType: 'CASELOAD', conditionValue: 'MDI', blockAccess: true }])

    await page.goto('/admin/prisons')

    const adminPage = await AdminPrisonsPage.verifyOnPage(page)
    await expect(adminPage.activeCount).toContainText('CSRA is switched on for 1 of 2 prisons.')
    await expect(adminPage.dpsStatus('LEI')).toContainText('Off')
    await expect(adminPage.dpsStatus('MDI')).toContainText('On')
    await expect(adminPage.nomisStatus('LEI')).toContainText('Normal')
    await expect(adminPage.nomisStatus('MDI')).toContainText('Blocked')
  })

  test('switches a prison on and reflects the new state', async ({ page }) => {
    await login(page, { roles: ADMIN_ROLES })
    await csraApi.stubGetAllAgencies(AGENCIES)
    await prisonApi.stubGetSplashScreen([])
    await csraApi.stubSetAgencyActive({ agencyId: 'LEI', name: 'Leeds (HMP)', active: true })

    await page.goto('/admin/prisons')
    const adminPage = await AdminPrisonsPage.verifyOnPage(page)

    // A higher-priority stub wins for the re-read after the redirect, so the row shows the new state.
    await csraApi.stubGetAllAgencies(
      [
        { agencyId: 'LEI', name: 'Leeds (HMP)', active: true },
        { agencyId: 'MDI', name: 'Moorland (HMP)', active: true },
      ],
      1,
    )
    await adminPage.dpsToggle('LEI').click()

    await expect(adminPage.successBanner).toContainText('CSRA is now switched on for Leeds (HMP).')
    await expect(adminPage.dpsStatus('LEI')).toContainText('On')
  })

  test('blocks the NOMIS CSRA screen for a prison', async ({ page }) => {
    await login(page, { roles: ADMIN_ROLES })
    await csraApi.stubGetAllAgencies(AGENCIES)
    await prisonApi.stubGetSplashScreen([])
    await prisonApi.stubAddSplashCondition()

    await page.goto('/admin/prisons')
    const adminPage = await AdminPrisonsPage.verifyOnPage(page)

    await prisonApi.stubGetSplashScreen([{ conditionType: 'CASELOAD', conditionValue: 'MDI', blockAccess: true }], 1)
    await adminPage.nomisBlock('MDI').click()

    await expect(adminPage.successBanner).toContainText('NOMIS CSRA access is now blocked for Moorland (HMP).')
    await expect(adminPage.nomisStatus('MDI')).toContainText('Blocked')
  })

  test('flags a prison whose two NOMIS screens disagree, and repairs it', async ({ page }) => {
    await login(page, { roles: ADMIN_ROLES })
    await csraApi.stubGetAllAgencies(AGENCIES)
    // Blocked on the questionnaire screen only, e.g. changed directly in NOMIS.
    await prisonApi.stubGetSplashScreen([], undefined, ['OIDCAPPR'])
    await prisonApi.stubGetSplashScreen(
      [{ conditionType: 'CASELOAD', conditionValue: 'MDI', blockAccess: true }],
      undefined,
      ['OCDNOQUE'],
    )
    await prisonApi.stubAddSplashCondition()

    await page.goto('/admin/prisons')
    const adminPage = await AdminPrisonsPage.verifyOnPage(page)
    await expect(adminPage.nomisStatus('MDI')).toContainText('Mixed')

    await prisonApi.stubGetSplashScreen([{ conditionType: 'CASELOAD', conditionValue: 'MDI', blockAccess: true }], 1)
    await adminPage.nomisBlock('MDI').click()

    await expect(adminPage.successBanner).toContainText('NOMIS CSRA access is now blocked for Moorland (HMP).')
    await expect(adminPage.nomisStatus('MDI')).toContainText('Blocked')
  })

  test('explains when the NOMIS splash screen has not been set up', async ({ page }) => {
    await login(page, { roles: ADMIN_ROLES })
    await csraApi.stubGetAllAgencies(AGENCIES)
    await prisonApi.stubSplashScreenNotSetUp()

    await page.goto('/admin/prisons')

    const adminPage = await AdminPrisonsPage.verifyOnPage(page)
    await expect(adminPage.nomisUnavailable).toContainText('status is currently unavailable')
    await expect(adminPage.nomisBlock('MDI')).toHaveCount(0)
  })

  test('filters the list by prison name', async ({ page }) => {
    await login(page, { roles: ADMIN_ROLES })
    await csraApi.stubGetAllAgencies(AGENCIES)
    await prisonApi.stubGetSplashScreen([])

    await page.goto('/admin/prisons')
    const adminPage = await AdminPrisonsPage.verifyOnPage(page)

    await adminPage.search.fill('leeds')
    await adminPage.searchButton.click()

    await expect(adminPage.prisonsTable).toContainText('Leeds (HMP)')
    await expect(adminPage.prisonsTable).not.toContainText('Moorland (HMP)')
  })

  test('is not available to a user without the admin role', async ({ page }) => {
    await login(page)

    await page.goto('/admin/prisons')

    // The layout always renders its own (empty) title h1, so match the heading by name.
    await expect(page.getByRole('heading', { name: 'Authorisation Error' })).toBeVisible()
  })
})
