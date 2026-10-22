import type { SuperAgentRequest } from 'superagent'
import { stubFor } from './wiremock'
import type { SplashScreenCondition } from '../../server/data/prisonApiTypes'

// Must match NOMIS_CSRA_MODULES in feature.env, as the URL prefixes above match its API URLs.
const NOMIS_CSRA_MODULES = ['OCDNOQUE', 'OIDCAPPR']

// The config defaults for the NOMIS CSRA agency switches.
const NOMIS_CSRA_SWITCH = 'CSRA'
const NOMIS_AUTO_APPROVAL_SWITCH = 'CSRA_AUTO_APPROVAL'

// 1x1 transparent PNG, enough for the banner <img> to load in tests.
const PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: '/prison-api/health/ping',
      },
      response: {
        status: httpStatus,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: { status: httpStatus === 200 ? 'UP' : 'DOWN' },
      },
    }),

  stubGetPrisonerImage: (prisonerNumber: string): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: `/prison-api/api/bookings/offenderNo/${prisonerNumber}/image/data`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
        base64Body: PIXEL_PNG_BASE64,
      },
    }),

  /**
   * The NOMIS splash screens that gate the legacy CSRA screens. `conditions` are the per-caseload
   * warn/block entries the admin console manages.
   *
   * Every module is stubbed with the same conditions, which is the normal case since the console
   * always sets them together. Pass `modules` to stub only some of them — leaving the others to an
   * earlier stub — to produce a prison whose screens disagree.
   */
  stubGetSplashScreen: (
    conditions: SplashScreenCondition[] = [],
    priority?: number,
    modules: string[] = NOMIS_CSRA_MODULES,
  ): Promise<unknown> =>
    Promise.all(
      modules.map(moduleName =>
        stubFor({
          priority,
          request: {
            method: 'GET',
            urlPattern: `/prison-api/api/splash-screen/${moduleName}`,
          },
          response: {
            status: 200,
            headers: { 'Content-Type': 'application/json;charset=UTF-8' },
            jsonBody: { moduleName, conditions },
          },
        }),
      ),
    ),

  /** The splash screens have not been created in NOMIS yet. */
  stubSplashScreenNotSetUp: (modules: string[] = NOMIS_CSRA_MODULES): Promise<unknown> =>
    Promise.all(
      modules.map(moduleName =>
        stubFor({
          request: {
            method: 'GET',
            urlPattern: `/prison-api/api/splash-screen/${moduleName}`,
          },
          response: { status: 404 },
        }),
      ),
    ),

  stubAddSplashCondition: (): Promise<unknown> =>
    Promise.all(
      NOMIS_CSRA_MODULES.map(moduleName =>
        stubFor({
          request: {
            method: 'POST',
            urlPattern: `/prison-api/api/splash-screen/${moduleName}/condition`,
          },
          response: {
            status: 200,
            headers: { 'Content-Type': 'application/json;charset=UTF-8' },
            jsonBody: { moduleName, conditions: [] },
          },
        }),
      ),
    ),

  stubUpdateSplashCondition: (): Promise<unknown> =>
    Promise.all(
      NOMIS_CSRA_MODULES.map(moduleName =>
        stubFor({
          request: {
            method: 'PUT',
            urlPathPattern: `/prison-api/api/splash-screen/${moduleName}/condition/.*`,
          },
          response: {
            status: 200,
            headers: { 'Content-Type': 'application/json;charset=UTF-8' },
            jsonBody: { moduleName, conditions: [] },
          },
        }),
      ),
    ),

  stubRemoveSplashCondition: (): Promise<unknown> =>
    Promise.all(
      NOMIS_CSRA_MODULES.map(moduleName =>
        stubFor({
          request: {
            method: 'DELETE',
            urlPathPattern: `/prison-api/api/splash-screen/${moduleName}/condition/.*`,
          },
          response: { status: 200, headers: { 'Content-Type': 'application/json;charset=UTF-8' }, jsonBody: {} },
        }),
      ),
    ),

  /**
   * The NOMIS agency switches from Syscon CR 502: the agencies each one is switched on for. Without
   * this stub the switch reads 404, as in a NOMIS environment that does not have them yet.
   */
  stubGetAgencySwitches: (
    { csra = [], autoApproval = [] }: { csra?: string[]; autoApproval?: string[] } = {},
    priority?: number,
  ): Promise<unknown> =>
    Promise.all(
      Object.entries({ [NOMIS_CSRA_SWITCH]: csra, [NOMIS_AUTO_APPROVAL_SWITCH]: autoApproval }).map(
        ([serviceCode, agencyIds]) =>
          stubFor({
            priority,
            request: {
              method: 'GET',
              urlPattern: `/prison-api/api/agency-switches/${serviceCode}`,
            },
            response: {
              status: 200,
              headers: { 'Content-Type': 'application/json;charset=UTF-8' },
              jsonBody: agencyIds.map(agencyId => ({ agencyId, name: agencyId })),
            },
          }),
      ),
    ),

  stubAddAgencySwitch: (): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'POST',
        urlPathPattern: '/prison-api/api/agency-switches/.*/agency/.*',
      },
      response: {
        status: 201,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: { agencyId: 'MDI', name: 'Moorland (HMP)' },
      },
    }),

  stubRemoveAgencySwitch: (): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'DELETE',
        urlPathPattern: '/prison-api/api/agency-switches/.*/agency/.*',
      },
      response: { status: 204 },
    }),
}
