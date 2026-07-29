import type { Express } from 'express'
import request from 'supertest'
import { appWithAllRoutes, flashProvider, user } from './testutils/appSetup'
import AuditService, { Page } from '../services/auditService'
import CsraService from '../services/csraService'
import PrisonerSearchService from '../services/prisonerSearchService'
import ManageUsersService from '../services/manageUsersService'
import PrisonApiService from '../services/prisonApiService'
import ActiveAgenciesService from '../services/activeAgenciesService'
import type { CsraCurrentRating, CsraReviewHistory } from '../data/csraApiTypes'
import type { Prisoner } from '../data/prisonerSearchApiTypes'
import { Role } from '../utils/roles'
import { NomisScreenNotSetUpError } from '../utils/nomisSplash'

jest.mock('../services/auditService')
jest.mock('../services/csraService')
jest.mock('../services/prisonerSearchService')
jest.mock('../services/manageUsersService')
jest.mock('../services/prisonApiService')
jest.mock('../services/activeAgenciesService')

const auditService = new AuditService(null) as jest.Mocked<AuditService>
const csraService = new CsraService(null) as jest.Mocked<CsraService>
const prisonerSearchService = new PrisonerSearchService(null) as jest.Mocked<PrisonerSearchService>
const manageUsersService = new ManageUsersService(null) as jest.Mocked<ManageUsersService>
const prisonApiService = new PrisonApiService(null, null) as jest.Mocked<PrisonApiService>
const activeAgenciesService = new ActiveAgenciesService(null) as jest.Mocked<ActiveAgenciesService>

const adminUser = { ...user, userRoles: [Role.CSRA__ADMIN] }

let app: Express

beforeEach(() => {
  // The prisoner fixtures below sit in LEI, which is in the user's caseloads, so the access guard
  // (checkPrisonerAccess) lets these requests through. Access rules are covered in
  // checkPrisonerAccess.test.ts.
  manageUsersService.getUserCaseloads.mockResolvedValue({
    username: 'user1',
    active: true,
    accountType: 'GENERAL',
    activeCaseload: { id: 'LEI', name: 'Leeds (HMP)' },
    caseloads: [{ id: 'LEI', name: 'Leeds (HMP)' }],
  })
  csraService.getRatingSummary.mockResolvedValue({
    prisonId: 'LEI',
    total: 1015,
    noRating: 0,
    highRisk: 217,
    standardRisk: 795,
  })
  app = appWithAllRoutes({
    services: {
      auditService,
      csraService,
      prisonerSearchService,
      manageUsersService,
      prisonApiService,
      activeAgenciesService,
    },
    userSupplier: () => user,
  })
})

/** The same app but signed in as a rollout admin, for the admin console tests. */
const adminApp = () =>
  appWithAllRoutes({
    services: {
      auditService,
      csraService,
      prisonerSearchService,
      manageUsersService,
      prisonApiService,
      activeAgenciesService,
    },
    userSupplier: () => adminUser,
  })

afterEach(() => {
  jest.resetAllMocks()
})

describe('GET /', () => {
  it('should render index page', () => {
    auditService.logPageView.mockResolvedValue(null)

    return request(app)
      .get('/')
      .expect('Content-Type', /html/)
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('Cell sharing risk assessment (CSRA)')
        expect(auditService.logPageView).toHaveBeenCalledWith(Page.INDEX, {
          who: user.username,
          correlationId: expect.any(String),
        })
      })
  })
})

describe('GET /prisoner/:prisonerNumber', () => {
  const prisoner: Prisoner = {
    prisonerNumber: 'A1234BC',
    firstName: 'JOHN',
    lastName: 'SMITH',
    prisonId: 'LEI',
    prisonName: 'Moorland (HMP)',
    cellLocation: 'A-1-001',
  }

  beforeEach(() => {
    auditService.logPageView.mockResolvedValue(null)
    prisonerSearchService.getPrisoner.mockResolvedValue(prisoner)
  })

  it('renders the current CSRA for a prisoner and audits the page view', () => {
    const csra: CsraCurrentRating = {
      prisonerNumber: 'A1234BC',
      status: 'COMPLETE',
      rating: 'HIGH_SPECIFIC',
      provisional: false,
      reviewId: 'de91dfa7-821f-4552-a427-bf2f32eafeb0',
      riskTo: [{ category: 'DIFFERENT_ETHNICITY', details: 'Racist towards other ethnicities.' }],
      vulnerabilities: [{ category: 'NEURODIVERSITY', details: null }],
      finalDate: '2026-07-01',
    }
    csraService.getCurrentRating.mockResolvedValue(csra)

    return request(app)
      .get('/prisoner/A1234BC')
      .expect('Content-Type', /html/)
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('John Smith')
        expect(res.text).toContain('A1234BC')
        expect(res.text).toContain('High risk – specific')
        expect(res.text).toContain('Different ethnicity')
        expect(res.text).toContain('Neurodiversity')
        expect(res.text).toContain('1 July 2026')
        expect(prisonerSearchService.getPrisoner).toHaveBeenCalledWith(user.username, 'A1234BC')
        expect(csraService.getCurrentRating).toHaveBeenCalledWith(user.username, 'A1234BC')
        expect(auditService.logPageView).toHaveBeenCalledWith(Page.PRISONER_CSRA, {
          who: user.username,
          subjectId: 'A1234BC',
          subjectType: 'PRISONER_ID',
          correlationId: expect.any(String),
        })
      })
  })

  it('shows a no-CSRA message when the prisoner has no current rating', () => {
    csraService.getCurrentRating.mockResolvedValue({
      prisonerNumber: 'A1234BC',
      status: 'NO_RATING',
      rating: null,
      provisional: false,
      riskTo: [],
      vulnerabilities: [],
    })

    return request(app)
      .get('/prisoner/A1234BC')
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('does not have a current CSRA')
      })
  })
})

describe('GET /prisoner/:prisonerNumber/history', () => {
  const prisoner: Prisoner = {
    prisonerNumber: 'A1234BC',
    firstName: 'DANIEL',
    lastName: 'HAVERS',
    dateOfBirth: '1972-02-03',
    prisonId: 'LEI',
    pncNumber: '15/17564AG',
  }

  const history: CsraReviewHistory = {
    summary: {
      totalCsras: 13,
      highCount: 2,
      standardCount: 11,
      firstAssessmentDate: '2011-06-15',
      lastAssessmentDate: '2025-10-11',
      lastHighDate: '2013-07-14',
    },
    content: [
      {
        id: 'de91dfa7-821f-4552-a427-bf2f32eafeb0',
        type: 'REVIEW',
        rating: 'HIGH_SPECIFIC',
        reviewComment: 'Cannot share with specific groups.',
        prisonId: 'LEI',
        recordedDate: '2024-07-23',
      },
    ],
    page: 0,
    size: 20,
    totalElements: 13,
    totalPages: 5,
  }

  beforeEach(() => {
    auditService.logPageView.mockResolvedValue(null)
    prisonerSearchService.getPrisoner.mockResolvedValue(prisoner)
  })

  it('renders the history list, summary and banner, and audits the page view', () => {
    csraService.getHistory.mockResolvedValue(history)

    return request(app)
      .get('/prisoner/A1234BC/history')
      .expect('Content-Type', /html/)
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('CSRA history')
        expect(res.text).toContain('Daniel Havers')
        expect(res.text).toContain('15/17564AG') // PNC in the banner
        expect(res.text).toContain('3 February 1972') // DOB in the banner
        expect(res.text).toContain('High risk – specific')
        expect(res.text).toContain('Cannot share with specific groups.')
        expect(res.text).toContain('Recorded at LEI')
        expect(res.text).toContain('June 2011') // summary date range
        expect(res.text).toContain('Last high 14 July 2013')
        expect(res.text).toContain('of <strong>13</strong> CSRAs')
        expect(csraService.getHistory).toHaveBeenCalledWith(user.username, 'A1234BC', {
          page: '0',
          size: '20',
          ratings: undefined,
          establishments: undefined,
          fromDate: undefined,
          toDate: undefined,
        })
        expect(auditService.logPageView).toHaveBeenCalledWith(Page.PRISONER_CSRA_HISTORY, {
          who: user.username,
          subjectId: 'A1234BC',
          subjectType: 'PRISONER_ID',
          correlationId: expect.any(String),
        })
      })
  })

  it('passes whitelisted rating/establishment/date filters and the zero-based page to the service', () => {
    csraService.getHistory.mockResolvedValue(history)

    return request(app)
      .get('/prisoner/A1234BC/history?ratings=HIGH&ratings=BOGUS&establishments=lei&fromDate=1/1/2020&page=2')
      .expect(200)
      .expect(() => {
        expect(csraService.getHistory).toHaveBeenCalledWith(user.username, 'A1234BC', {
          page: '1',
          size: '20',
          ratings: ['HIGH'],
          establishments: ['LEI'],
          fromDate: '2020-01-01',
          toDate: undefined,
        })
      })
  })

  it('renders establishment checkboxes and resolves prison names when the summary supplies them', () => {
    csraService.getHistory.mockResolvedValue({
      ...history,
      summary: {
        ...history.summary,
        establishments: [
          { prisonId: 'HLI', prisonName: 'Hull (HMP)' },
          { prisonId: 'LEI', prisonName: 'Leeds (HMP)' },
        ],
      },
    })

    return request(app)
      .get('/prisoner/A1234BC/history')
      .expect(200)
      .expect(res => {
        // Establishment filter checkboxes
        expect(res.text).toContain('Hull (HMP)')
        expect(res.text).toContain('value="LEI"')
        // "Recorded at" resolves the prison name instead of the raw id
        expect(res.text).toContain('Recorded at Leeds (HMP)')
        expect(res.text).not.toContain('Recorded at LEI')
      })
  })

  it('shows an empty message when the prisoner has no history', () => {
    csraService.getHistory.mockResolvedValue({
      summary: { totalCsras: 0, highCount: 0, standardCount: 0 },
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    })

    return request(app)
      .get('/prisoner/A1234BC/history')
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('No CSRAs found.')
      })
  })

  it('returns 404 for an invalid prisoner number', () => {
    return request(app).get('/prisoner/not-a-number/history').expect(404)
  })
})

describe('Admin - manage enabled prisons', () => {
  const agencies = [
    { agencyId: 'LEI', name: 'Leeds (HMP)', active: false },
    { agencyId: 'MDI', name: 'Moorland (HMP)', active: true },
  ]

  beforeEach(() => {
    flashProvider.mockReturnValue([])
    csraService.getAllAgencies.mockResolvedValue(agencies)
    prisonApiService.getNomisScreenStates.mockResolvedValue(new Map())
    auditService.logPageView.mockResolvedValue(null)
    auditService.logAuditEvent.mockResolvedValue(null)
  })

  describe('GET /admin/prisons', () => {
    it('lists every prison with its DPS state and audits the page view', () => {
      return request(adminApp())
        .get('/admin/prisons')
        .expect('Content-Type', /html/)
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('Manage enabled prisons')
          expect(res.text).toContain('CSRA is switched on for 1 of 2 prisons.')
          expect(res.text).toContain('Leeds (HMP)')
          expect(res.text).toContain('Moorland (HMP)')
          expect(auditService.logPageView).toHaveBeenCalledWith(Page.ADMIN_PRISONS, {
            who: adminUser.username,
            correlationId: expect.any(String),
          })
        })
    })

    it('filters the list by the search term', () => {
      return request(adminApp())
        .get('/admin/prisons?q=leeds')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('Leeds (HMP)')
          expect(res.text).not.toContain('Moorland (HMP)')
        })
    })

    it('tells the admin when no prison matches the search', () => {
      return request(adminApp())
        .get('/admin/prisons?q=nowhere')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('No prisons match your search.')
        })
    })

    it('shows the NOMIS state and only the transitions the prison is not already in', () => {
      prisonApiService.getNomisScreenStates.mockResolvedValue(new Map([['MDI', 'BLOCKED']]))

      return request(adminApp())
        .get('/admin/prisons')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('Blocked')
          expect(res.text).toContain('data-qa="nomis-warning-MDI"')
          expect(res.text).toContain('data-qa="nomis-clear-MDI"')
          expect(res.text).not.toContain('data-qa="nomis-block-MDI"')
        })
    })

    it('flags a prison whose NOMIS screens disagree, offering every state so it can be repaired', () => {
      prisonApiService.getNomisScreenStates.mockResolvedValue(new Map([['MDI', 'MIXED']]))

      return request(adminApp())
        .get('/admin/prisons')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('Mixed')
          // None of the three states matches, so all are offered.
          expect(res.text).toContain('data-qa="nomis-warning-MDI"')
          expect(res.text).toContain('data-qa="nomis-block-MDI"')
          expect(res.text).toContain('data-qa="nomis-clear-MDI"')
        })
    })

    it('reports the NOMIS screen as unavailable and hides its controls when it cannot be read', () => {
      prisonApiService.getNomisScreenStates.mockResolvedValue(null)

      return request(adminApp())
        .get('/admin/prisons')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('status is currently unavailable')
          expect(res.text).toContain('Unknown')
          expect(res.text).not.toContain('data-qa="nomis-block-MDI"')
        })
    })

    it('is forbidden for a user without the admin role', () => {
      return request(app)
        .get('/admin/prisons')
        .expect(403)
        .expect(res => {
          expect(res.text).toContain('Authorisation Error')
          expect(csraService.getAllAgencies).not.toHaveBeenCalled()
        })
    })
  })

  describe('POST /admin/prisons/:agencyId', () => {
    it('switches a prison on, drops the cached rollout state and redirects with a success flash', () => {
      csraService.setAgencyActive.mockResolvedValue({ agencyId: 'LEI', name: 'Leeds (HMP)', active: true })

      return request(adminApp())
        .post('/admin/prisons/LEI')
        .send({ active: 'true', name: 'Leeds (HMP)' })
        .expect(302)
        .expect('Location', '/admin/prisons')
        .expect(() => {
          expect(csraService.setAgencyActive).toHaveBeenCalledWith(adminUser.username, 'LEI', true)
          expect(activeAgenciesService.applyAgencyChange).toHaveBeenCalledWith('LEI', true)
          expect(flashProvider).toHaveBeenCalledWith('success', 'CSRA is now switched on for Leeds (HMP).')
          expect(auditService.logAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({ what: 'SET_PRISON_ACTIVE', subjectId: 'LEI', details: { active: true } }),
          )
        })
    })

    it('switches a prison off and keeps the admin on the same filtered view', () => {
      csraService.setAgencyActive.mockResolvedValue({ agencyId: 'MDI', name: 'Moorland (HMP)', active: false })

      return request(adminApp())
        .post('/admin/prisons/MDI')
        .send({ active: 'false', name: 'Moorland (HMP)', q: 'moor' })
        .expect(302)
        .expect('Location', '/admin/prisons?q=moor')
        .expect(() => {
          expect(csraService.setAgencyActive).toHaveBeenCalledWith(adminUser.username, 'MDI', false)
          expect(flashProvider).toHaveBeenCalledWith('success', 'CSRA is now switched off for Moorland (HMP).')
        })
    })

    it('is forbidden for a user without the admin role', () => {
      return request(app)
        .post('/admin/prisons/LEI')
        .send({ active: 'true' })
        .expect(403)
        .expect(() => {
          expect(csraService.setAgencyActive).not.toHaveBeenCalled()
        })
    })
  })

  describe('POST /admin/prisons/:agencyId/nomis-screen', () => {
    it('blocks the NOMIS screen and redirects with a success flash', () => {
      prisonApiService.setNomisScreenState.mockResolvedValue(undefined)

      return request(adminApp())
        .post('/admin/prisons/MDI/nomis-screen')
        .send({ state: 'BLOCKED', name: 'Moorland (HMP)' })
        .expect(302)
        .expect('Location', '/admin/prisons')
        .expect(() => {
          expect(prisonApiService.setNomisScreenState).toHaveBeenCalledWith(adminUser.username, 'MDI', 'BLOCKED')
          expect(flashProvider).toHaveBeenCalledWith('success', 'NOMIS CSRA access is now blocked for Moorland (HMP).')
          expect(auditService.logAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({ what: 'SET_NOMIS_CSRA_SCREEN', subjectId: 'MDI', details: { state: 'BLOCKED' } }),
          )
        })
    })

    it('rejects an unrecognised state without calling prison-api', () => {
      return request(adminApp())
        .post('/admin/prisons/MDI/nomis-screen')
        .send({ state: 'NONSENSE', name: 'Moorland (HMP)' })
        .expect(302)
        .expect(() => {
          expect(prisonApiService.setNomisScreenState).not.toHaveBeenCalled()
          expect(flashProvider).toHaveBeenCalledWith('error', 'Select a valid NOMIS CSRA screen state.')
        })
    })

    it('explains that the splash screen has not been set up in NOMIS yet', () => {
      prisonApiService.setNomisScreenState.mockRejectedValue(new NomisScreenNotSetUpError(['OIDCAPPR']))

      return request(adminApp())
        .post('/admin/prisons/MDI/nomis-screen')
        .send({ state: 'BLOCKED', name: 'Moorland (HMP)' })
        .expect(302)
        .expect(() => {
          expect(flashProvider).toHaveBeenCalledWith('error', expect.stringContaining('OIDCAPPR'))
          expect(auditService.logAuditEvent).not.toHaveBeenCalled()
        })
    })

    it('is forbidden for a user without the admin role', () => {
      return request(app)
        .post('/admin/prisons/MDI/nomis-screen')
        .send({ state: 'BLOCKED' })
        .expect(403)
        .expect(() => {
          expect(prisonApiService.setNomisScreenState).not.toHaveBeenCalled()
        })
    })
  })

  describe('the admin tile on the landing page', () => {
    beforeEach(() => {
      csraService.getRatingSummary.mockResolvedValue({
        prisonId: 'LEI',
        total: 10,
        noRating: 1,
        highRisk: 2,
        standardRisk: 7,
      })
    })

    it('is shown to an admin', () => {
      return request(adminApp())
        .get('/')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('Manage enabled prisons')
          expect(res.text).toContain('/admin/prisons')
        })
    })

    it('is hidden from a user without the admin role', () => {
      return request(app)
        .get('/')
        .expect(200)
        .expect(res => {
          expect(res.text).not.toContain('/admin/prisons')
        })
    })
  })
})
