import AllPrisonersController from './allPrisonersController'
import { Page } from '../services/auditService'

describe('allPrisonersController', () => {
  let auditService: { logPageView: jest.Mock }
  let csraService: { getPrisonPrisoners: jest.Mock }

  beforeEach(() => {
    auditService = {
      logPageView: jest.fn().mockResolvedValue(null),
    }

    csraService = {
      getPrisonPrisoners: jest.fn().mockResolvedValue({
        content: [
          {
            prisonerNumber: 'A1234BC',
            firstName: 'Callum',
            lastName: 'Reid',
            rating: 'HIGH_GENERAL',
            provisional: false,
            assessmentType: 'ASSESSMENT',
            assessedOn: '2026-03-05',
          },
        ],
        page: 0,
        size: 25,
        totalElements: 1,
        totalPages: 1,
      }),
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders the all prisoners page with default query values', async () => {
    const controller = new AllPrisonersController({ auditService, csraService } as any)

    const req = {
      id: 'request-id-123',
      query: {},
    } as any

    const res = {
      locals: {
        user: { username: 'USER1' },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'MDI' } } },
      },
      render: jest.fn(),
    } as any

    await controller.index(req, res, jest.fn())

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.ALL_PRISONERS, {
      who: 'USER1',
      correlationId: 'request-id-123',
    })

    expect(csraService.getPrisonPrisoners).toHaveBeenCalledWith('USER1', 'MDI', {
      ratings: undefined,
      assessmentTypes: undefined,
      fromDate: undefined,
      toDate: undefined,
      sort: 'ASSESSED_ON',
      direction: 'DESC',
      page: 0,
      size: 25,
    })

    expect(res.render).toHaveBeenCalledWith(
      'pages/allPrisoners',
      expect.objectContaining({
        title: 'CSRA ratings for all prisoners',
        hasSelectedFilters: false,
        selectedRatings: [],
        selectedAssessmentTypes: [],
        assessmentDateFrom: undefined,
        assessmentDateTo: undefined,
        sort: 'ASSESSED_ON',
        direction: 'DESC',
        currentPage: 1,
        totalPages: 1,
        totalResults: 1,
        pageSize: 25,
      }),
    )
    expect(res.locals.validationErrors).toBeUndefined()
  })

  it('parses filters, sort and pagination before querying CSRA', async () => {
    csraService.getPrisonPrisoners.mockResolvedValueOnce({
      content: [],
      page: 2,
      size: 25,
      totalElements: 63,
      totalPages: 3,
    })

    const controller = new AllPrisonersController({ auditService, csraService } as any)

    const req = {
      id: 'request-id-456',
      query: {
        rating: ['HIGH', 'STANDARD'],
        assessmentType: 'REVIEW',
        assessmentDateFrom: '1/2/2026',
        assessmentDateTo: '10/2/2026',
        sort: 'name',
        direction: 'ascending',
        page: '3',
      },
    } as any

    const res = {
      locals: {
        user: { username: 'USER2' },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'LEI' } } },
      },
      render: jest.fn(),
    } as any

    await controller.index(req, res, jest.fn())

    expect(csraService.getPrisonPrisoners).toHaveBeenCalledWith('USER2', 'LEI', {
      ratings: ['HIGH', 'STANDARD'],
      assessmentTypes: ['REVIEW'],
      fromDate: '2026-02-01',
      toDate: '2026-02-10',
      sort: 'NAME',
      direction: 'ASC',
      page: 2,
      size: 25,
    })

    expect(res.render).toHaveBeenCalledWith(
      'pages/allPrisoners',
      expect.objectContaining({
        hasSelectedFilters: true,
        selectedRatings: ['HIGH', 'STANDARD'],
        selectedAssessmentTypes: ['REVIEW'],
        assessmentDateFrom: '1/2/2026',
        assessmentDateTo: '10/2/2026',
        sort: 'NAME',
        direction: 'ASC',
        currentPage: 3,
        totalPages: 3,
        totalResults: 63,
      }),
    )
  })

  it('ignores invalid sort and filter query values, falling back to defaults', async () => {
    const controller = new AllPrisonersController({ auditService, csraService } as any)

    const req = {
      id: 'request-id-789',
      query: {
        rating: ['HIGH', 'BANANA', 'standard'],
        assessmentType: ['review', 'WRONG'],
        sort: 'banana',
        direction: 'not-a-direction',
      },
    } as any

    const res = {
      locals: {
        user: { username: 'USER3' },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'MDI' } } },
      },
      render: jest.fn(),
    } as any

    await controller.index(req, res, jest.fn())

    expect(csraService.getPrisonPrisoners).toHaveBeenCalledWith('USER3', 'MDI', {
      ratings: ['HIGH', 'STANDARD'],
      assessmentTypes: ['REVIEW'],
      fromDate: undefined,
      toDate: undefined,
      sort: 'ASSESSED_ON',
      direction: 'DESC',
      page: 0,
      size: 25,
    })

    expect(res.render).toHaveBeenCalledWith(
      'pages/allPrisoners',
      expect.objectContaining({
        selectedRatings: ['HIGH', 'STANDARD'],
        selectedAssessmentTypes: ['REVIEW'],
        sort: 'ASSESSED_ON',
        direction: 'DESC',
      }),
    )
  })
})
