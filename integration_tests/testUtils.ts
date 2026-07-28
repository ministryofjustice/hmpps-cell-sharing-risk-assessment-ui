import { Page } from '@playwright/test'
import tokenVerification from './mockApis/tokenVerification'
import hmppsAuth, { type UserToken } from './mockApis/hmppsAuth'
import componentApi from './mockApis/componentApi'
import { resetStubs } from './mockApis/wiremock'

export { resetStubs }

const DEFAULT_ROLES = ['ROLE_SOME_REQUIRED_ROLE']

export const attemptHmppsAuthLogin = async (page: Page) => {
  await page.goto('/')
  page.locator('h1', { hasText: 'Sign in' })
  const url = await hmppsAuth.getSignInUrl()
  await page.goto(url)
}

export const login = async (
  page: Page,
  {
    name,
    roles = DEFAULT_ROLES,
    active = true,
    authSource = 'nomis',
    // Left undefined so stubComponents applies its own default establishment. Pass one to put the
    // user at a particular prison, or null for no active caseload — the active caseload also drives
    // the CSRA rollout gate on the landing page.
    activeCaseLoad,
  }: UserToken & { active?: boolean; activeCaseLoad?: { caseLoadId: string; description: string } | null } = {},
) => {
  await Promise.all([
    hmppsAuth.favicon(),
    hmppsAuth.stubSignInPage(),
    hmppsAuth.stubSignOutPage(),
    hmppsAuth.token({ name, roles, authSource }),
    tokenVerification.stubVerifyToken(active),
    // The DPS shared header/footer are fetched by getFrontendComponents on every authenticated page.
    ...(activeCaseLoad === undefined ? [componentApi.stubComponents()] : [componentApi.stubComponents(activeCaseLoad)]),
  ])
  await attemptHmppsAuthLogin(page)
}
