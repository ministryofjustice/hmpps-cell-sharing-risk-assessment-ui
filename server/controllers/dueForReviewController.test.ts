import dueForReviewController from './dueForReviewController'
import { Page } from '../services/auditService'

describe('dueForReviewController', () => {
  let auditService: { logPageView: jest.Mock }
  let csraService: { getHighRiskDueForReview: jest.Mock }

  beforeEach(() => {
    auditService = {
      logPageView: jest.fn().mockResolvedValue(null),
    }

    csraService = {
      getHighRiskDueForReview: jest.fn().mockResolvedValue({
        content: [],
        totalResults: 0,
        availableRatingTypes: ['HIGH', 'HIGH_SPECIFIC'],
      }),
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders due-for-review page with default query values', async () => {
    const controller = dueForReviewController({ auditService, csraService } as any)

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

    await controller(req, res, jest.fn())

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.DUE_FOR_REVIEW, {
      who: 'USER1',
      correlationId: 'request-id-123',
    })

    expect(csraService.getHighRiskDueForReview).toHaveBeenCalledWith('USER1', 'MDI', {
      ratingTypes: undefined,
      reviewDateFrom: undefined,
      reviewDateTo: undefined,
      sort: undefined,
      direction: undefined,
    })

    expect(res.render).toHaveBeenCalledWith(
      'pages/dueForReview',
      expect.objectContaining({
        reviewDateFrom: undefined,
        reviewDateTo: undefined,
        sort: undefined,
        direction: undefined,
        hasSelectedFilters: false,
      }),
    )
    expect(res.locals.validationErrors).toBeUndefined()
  })

  it('parses and submits selected filters and sort values', async () => {
    const controller = dueForReviewController({ auditService, csraService } as any)

    const req = {
      id: 'request-id-456',
      query: {
        ratingType: ['HIGH', 'HIGH_SPECIFIC'],
        reviewDateFrom: '1/2/2026',
        reviewDateTo: '10/2/2026',
        sort: 'name',
        direction: 'descending',
      },
    } as any

    const res = {
      locals: {
        user: { username: 'USER2' },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'LEI' } } },
      },
      render: jest.fn(),
    } as any

    await controller(req, res, jest.fn())

    expect(csraService.getHighRiskDueForReview).toHaveBeenCalledWith('USER2', 'LEI', {
      ratingTypes: ['HIGH', 'HIGH_SPECIFIC'],
      reviewDateFrom: '2026-02-01',
      reviewDateTo: '2026-02-10',
      sort: 'NAME',
      direction: 'DESC',
    })

    expect(res.render).toHaveBeenCalledWith(
      'pages/dueForReview',
      expect.objectContaining({
        reviewDateFrom: '1/2/2026',
        reviewDateTo: '10/2/2026',
        sort: 'NAME',
        direction: 'DESC',
        hasSelectedFilters: true,
        ratingTypeOptions: [
          { value: 'HIGH', text: 'High', checked: true },
          { value: 'HIGH_SPECIFIC', text: 'High risk – specific', checked: true },
        ],
      }),
    )
  })

  it('sets res.locals.errors and inline error props for invalid date inputs', async () => {
    const controller = dueForReviewController({ auditService, csraService } as any)

    const req = {
      id: 'request-id-789',
      query: {
        reviewDateFrom: '31/4/abcd',
        reviewDateTo: 'zzxxyy',
      },
    } as any

    const res = {
      locals: {
        user: { username: 'USER3' },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'MDI' } } },
      },
      render: jest.fn(),
    } as any

    await controller(req, res, jest.fn())

    expect(res.locals.validationErrors).toEqual({
      reviewDateFrom: { text: "'Review date from' must be a real date" },
      reviewDateTo: { text: "'Review date to' must be a real date" },
    })

    expect(res.render).toHaveBeenCalledWith(
      'pages/dueForReview',
      expect.not.objectContaining({ reviewDateFromError: expect.anything() }),
    )

    // Invalid dates are excluded from the API call
    expect(csraService.getHighRiskDueForReview).toHaveBeenCalledWith(
      'USER3',
      'MDI',
      expect.objectContaining({ reviewDateFrom: undefined, reviewDateTo: undefined }),
    )
  })
})
