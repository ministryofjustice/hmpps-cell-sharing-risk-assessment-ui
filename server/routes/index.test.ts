import type { Express } from 'express'
import request from 'supertest'
import { appWithAllRoutes, user } from './testutils/appSetup'
import AuditService, { Page } from '../services/auditService'
import CsraService from '../services/csraService'
import PrisonerSearchService from '../services/prisonerSearchService'
import type { CsraCurrentRating } from '../data/csraApiTypes'
import type { Prisoner } from '../data/prisonerSearchApiTypes'

jest.mock('../services/auditService')
jest.mock('../services/csraService')
jest.mock('../services/prisonerSearchService')

const auditService = new AuditService(null) as jest.Mocked<AuditService>
const csraService = new CsraService(null) as jest.Mocked<CsraService>
const prisonerSearchService = new PrisonerSearchService(null) as jest.Mocked<PrisonerSearchService>

let app: Express

beforeEach(() => {
  app = appWithAllRoutes({
    services: {
      auditService,
      csraService,
      prisonerSearchService,
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
