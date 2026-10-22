import { expect, test } from '@playwright/test'
import { login, resetStubs } from '../testUtils'
import AdminPrisonsPage from '../pages/adminPrisonsPage'
import csraApi from '../mockApis/csraApi'
import prisonApi from '../mockApis/prisonApi'
import { getMatchingRequests } from '../mockApis/wiremock'

const ADMIN_ROLES = ['ROLE_CSRA__ADMIN']

const AGENCIES = [
  { agencyId: 'LEI', name: 'Leeds (HMP)', active: false },
  { agencyId: 'MDI', name: 'Moorland (HMP)', active: true },
]

const blocked = (agencyId: string) => ({ conditionType: 'CASELOAD', conditionValue: agencyId, blockAccess: true })

/** How many times prison-api received a request, e.g. to add a switch. */
const requestCount = async (method: string, urlPath: string): Promise<number> =>
  (await getMatchingRequests({ method, urlPath })).body.requests.length

test.describe('Admin - manage enabled prisons', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  /** Moorland on DPS and blocked in NOMIS; Leeds on NOMIS with nothing set. */
  const stubConsistentNomis = async () => {
    await prisonApi.stubGetSplashScreen([blocked('MDI')])
    await prisonApi.stubGetAgencySwitches({ csra: ['MDI'] })
  }

  test('lists every prison with its DPS state and NOMIS approval step', async ({ page }) => {
    await login(page, { roles: ADMIN_ROLES })
    await csraApi.stubGetAllAgencies(AGENCIES)
    await stubConsistentNomis()

    await page.goto('/admin/prisons')

    const adminPage = await AdminPrisonsPage.verifyOnPage(page)
    await expect(adminPage.activeCount).toContainText('CSRA is switched on for 1 of 2 prisons.')
    await expect(adminPage.dpsStatus('LEI')).toContainText('Off')
    await expect(adminPage.dpsStatus('MDI')).toContainText('On')
    await expect(adminPage.nomisAttention('LEI')).toHaveCount(0)
    await expect(adminPage.nomisAttention('MDI')).toHaveCount(0)
    await expect(adminPage.approvalStatus('LEI')).toContainText('Required')
    await expect(adminPage.approvalStatus('MDI')).toContainText('Not used')
  })

  test('turns a prison on, blocking NOMIS and adding the CSRA switch', async ({ page }) => {
    await login(page, { roles: ADMIN_ROLES })
    await csraApi.stubGetAllAgencies(AGENCIES)
    await stubConsistentNomis()
    await prisonApi.stubAddSplashCondition()
    await prisonApi.stubAddAgencySwitch()
    await csraApi.stubSetAgencyActive({ agencyId: 'LEI', name: 'Leeds (HMP)', active: true })

    await page.goto('/admin/prisons')
    const adminPage = await AdminPrisonsPage.verifyOnPage(page)

    // A higher-priority stub wins for the re-read after the redirect, so the row shows the new DPS state.
    // NOMIS is not re-stubbed: the change reads NOMIS before writing, and must see it as it was.
    await csraApi.stubGetAllAgencies(
      [
        { agencyId: 'LEI', name: 'Leeds (HMP)', active: true },
        { agencyId: 'MDI', name: 'Moorland (HMP)', active: true },
      ],
      1,
    )
    await adminPage.turnOn('LEI').click()

    await expect(adminPage.successBanner).toContainText(
      'CSRA is now switched on for Leeds (HMP). The NOMIS CSRA screens are blocked.',
    )
    await expect(adminPage.dpsStatus('LEI')).toContainText('On')
    expect(await requestCount('PUT', '/csra-api/active-agencies/LEI')).toBe(1)
    expect(await requestCount('POST', '/prison-api/api/splash-screen/OCDNOQUE/condition')).toBe(1)
    expect(await requestCount('POST', '/prison-api/api/splash-screen/OIDCAPPR/condition')).toBe(1)
    expect(await requestCount('POST', '/prison-api/api/agency-switches/CSRA/agency/LEI')).toBe(1)
  })

  test('turns a prison off, opening NOMIS and removing the CSRA switch', async ({ page }) => {
    await login(page, { roles: ADMIN_ROLES })
    await csraApi.stubGetAllAgencies(AGENCIES)
    await stubConsistentNomis()
    await prisonApi.stubRemoveSplashCondition()
    await prisonApi.stubRemoveAgencySwitch()
    await csraApi.stubSetAgencyActive({ agencyId: 'MDI', name: 'Moorland (HMP)', active: false })

    await page.goto('/admin/prisons')
    const adminPage = await AdminPrisonsPage.verifyOnPage(page)

    await csraApi.stubGetAllAgencies(
      [
        { agencyId: 'LEI', name: 'Leeds (HMP)', active: false },
        { agencyId: 'MDI', name: 'Moorland (HMP)', active: false },
      ],
      1,
    )
    await adminPage.turnOff('MDI').click()

    await expect(adminPage.successBanner).toContainText(
      'CSRA is now switched off for Moorland (HMP). The NOMIS CSRA screens are open again.',
    )
    await expect(adminPage.dpsStatus('MDI')).toContainText('Off')
    expect(await requestCount('DELETE', '/prison-api/api/agency-switches/CSRA/agency/MDI')).toBe(1)
    expect(await requestCount('DELETE', '/prison-api/api/splash-screen/OCDNOQUE/condition/CASELOAD/MDI')).toBe(1)
    expect(await requestCount('DELETE', '/prison-api/api/splash-screen/OIDCAPPR/condition/CASELOAD/MDI')).toBe(1)
  })

  test('flags a prison whose NOMIS set-up does not match DPS, and puts it right', async ({ page }) => {
    await login(page, { roles: ADMIN_ROLES })
    await csraApi.stubGetAllAgencies(AGENCIES)
    // Moorland is on DPS but only blocked on the questionnaire screen, e.g. changed directly in NOMIS.
    await prisonApi.stubGetSplashScreen([], undefined, ['OIDCAPPR'])
    await prisonApi.stubGetSplashScreen([blocked('MDI')], undefined, ['OCDNOQUE'])
    await prisonApi.stubGetAgencySwitches({ csra: ['MDI'] })
    await prisonApi.stubAddSplashCondition()
    await csraApi.stubSetAgencyActive({ agencyId: 'MDI', name: 'Moorland (HMP)', active: true })

    await page.goto('/admin/prisons')
    const adminPage = await AdminPrisonsPage.verifyOnPage(page)
    await expect(adminPage.nomisAttention('MDI')).toContainText('NOMIS needs attention')

    await adminPage.turnOn('MDI').click()

    await expect(adminPage.successBanner).toContainText('CSRA is now switched on for Moorland (HMP).')
    // Only the screen that was out of step is changed.
    expect(await requestCount('POST', '/prison-api/api/splash-screen/OIDCAPPR/condition')).toBe(1)
    expect(await requestCount('POST', '/prison-api/api/splash-screen/OCDNOQUE/condition')).toBe(0)
  })

  test('removes the NOMIS approval step for a prison still on NOMIS', async ({ page }) => {
    await login(page, { roles: ADMIN_ROLES })
    await csraApi.stubGetAllAgencies(AGENCIES)
    await stubConsistentNomis()
    await prisonApi.stubAddAgencySwitch()
    await prisonApi.stubAddSplashCondition()

    await page.goto('/admin/prisons')
    const adminPage = await AdminPrisonsPage.verifyOnPage(page)
    await expect(adminPage.removeApproval('MDI')).toHaveCount(0)

    await adminPage.removeApproval('LEI').click()

    await expect(adminPage.successBanner).toContainText(
      'NOMIS CSRAs at Leeds (HMP) are now approved when they are saved, with no approval step.',
    )
    expect(await requestCount('POST', '/prison-api/api/splash-screen/OIDCAPPR/condition')).toBe(1)
    expect(await requestCount('POST', '/prison-api/api/agency-switches/CSRA_AUTO_APPROVAL/agency/LEI')).toBe(1)
    expect(await requestCount('POST', '/prison-api/api/splash-screen/OCDNOQUE/condition')).toBe(0)
  })

  test('hides the approval controls when the NOMIS switches are not set up yet', async ({ page }) => {
    await login(page, { roles: ADMIN_ROLES })
    await csraApi.stubGetAllAgencies(AGENCIES)
    // No agency switch stub, so they read as 404 - a NOMIS environment without Syscon CR 502.
    await prisonApi.stubGetSplashScreen([blocked('MDI')])

    await page.goto('/admin/prisons')

    const adminPage = await AdminPrisonsPage.verifyOnPage(page)
    await expect(adminPage.nomisSwitchesUnavailable).toContainText('the NOMIS header will not change')
    await expect(adminPage.removeApproval('LEI')).toHaveCount(0)
    await expect(adminPage.turnOn('LEI')).toBeVisible()
  })

  test('refuses to turn a prison on, changing nothing, when the NOMIS splash screen is not set up', async ({
    page,
  }) => {
    await login(page, { roles: ADMIN_ROLES })
    await csraApi.stubGetAllAgencies(AGENCIES)
    await prisonApi.stubSplashScreenNotSetUp()

    await page.goto('/admin/prisons')

    const adminPage = await AdminPrisonsPage.verifyOnPage(page)
    await expect(adminPage.nomisUnavailable).toContainText('status is currently unavailable')

    await adminPage.turnOn('LEI').click()

    await expect(adminPage.errorBanner).toContainText('Nothing has been changed.')
    expect(await requestCount('PUT', '/csra-api/active-agencies/LEI')).toBe(0)
  })

  test('filters the list by prison name', async ({ page }) => {
    await login(page, { roles: ADMIN_ROLES })
    await csraApi.stubGetAllAgencies(AGENCIES)
    await stubConsistentNomis()

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
