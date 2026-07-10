import type { Express } from 'express'
import request from 'supertest'
import { appWithAllRoutes, user } from './testutils/appSetup'
import AuditService, { Page } from '../services/auditService'
import CsraService from '../services/csraService'
import PrisonerSearchService from '../services/prisonerSearchService'
import ManageUsersService from '../services/manageUsersService'
import type { CsraCurrentRating, CsraReviewHistory } from '../data/csraApiTypes'
import type { Prisoner } from '../data/prisonerSearchApiTypes'

jest.mock('../services/auditService')
jest.mock('../services/csraService')
jest.mock('../services/prisonerSearchService')
jest.mock('../services/manageUsersService')

const auditService = new AuditService(null) as jest.Mocked<AuditService>
const csraService = new CsraService(null) as jest.Mocked<CsraService>
const prisonerSearchService = new PrisonerSearchService(null) as jest.Mocked<PrisonerSearchService>
const manageUsersService = new ManageUsersService(null) as jest.Mocked<ManageUsersService>

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
  app = appWithAllRoutes({
    services: {
      auditService,
      csraService,
      prisonerSearchService,
      manageUsersService,
    },
    userSupplier: () => user,
  })
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
        expect(res.text).toContain('This site is under construction...')
        expect(auditService.logPageView).toHaveBeenCalledWith(Page.EXAMPLE_PAGE, {
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
