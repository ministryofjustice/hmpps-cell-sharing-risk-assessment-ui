import RecentArrivalsController from './recentArrivalsController'
import { Page } from '../services/auditService'
import type { CsraRecentArrivals } from '../data/csraApiTypes'

const defaultRecentArrivals: CsraRecentArrivals = {
  days: [
    {
      date: '2026-08-06',
      arrivals: [
        {
          prisonerNumber: 'A5197BD',
          firstName: 'DANIEL',
          lastName: 'HAVERS',
          dateOfBirth: '1972-02-03',
          arrivalType: 'NEW_ADMISSION',
          arrivedAt: '2026-08-06T14:03:00',
          location: 'RECP',
        },
      ],
    },
    { date: '2026-08-05', arrivals: [] },
    { date: '2026-08-04', arrivals: [] },
  ],
  totalResults: 1,
  arrivalTypeCounts: { NEW_ADMISSION: 1, TRANSFER_IN: 0, COURT_RETURN: 0, TEMPORARY_ABSENCE_RETURN: 0 },
  fromDate: '2026-08-04',
  toDate: '2026-08-06',
}

describe('RecentArrivalsController', () => {
  let auditService: { logPageView: jest.Mock }
  let csraService: { getRecentArrivals: jest.Mock }

  beforeEach(() => {
    auditService = { logPageView: jest.fn().mockResolvedValue(null) }
    csraService = { getRecentArrivals: jest.fn().mockResolvedValue(defaultRecentArrivals) }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('logs the page view and renders with default (no filter) state', async () => {
    const controller = new RecentArrivalsController({ auditService, csraService } as any)

    const req = { id: 'req-id-1', query: {} } as any
    const res = {
      locals: {
        user: { username: 'USER1' },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'LEI' } } },
      },
      render: jest.fn(),
    } as any

    await controller.index(req, res, jest.fn())

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.RECENT_ARRIVALS, {
      who: 'USER1',
      correlationId: 'req-id-1',
    })

    expect(csraService.getRecentArrivals).toHaveBeenCalledWith('USER1', 'LEI', {
      days: 3,
      arrivalTypes: [],
    })

    expect(res.render).toHaveBeenCalledWith(
      'pages/recentArrivals',
      expect.objectContaining({
        title: 'People who have arrived in the last 3 days',
        recentArrivals: defaultRecentArrivals,
        arrivalTypeOptions: [
          { value: 'NEW_ADMISSION', text: 'New admissions (1)', checked: false },
          { value: 'TRANSFER_IN', text: 'Transfers in (0)', checked: false },
          { value: 'COURT_RETURN', text: 'Court returns (0)', checked: false },
          { value: 'TEMPORARY_ABSENCE_RETURN', text: 'Temporary absence returns (0)', checked: false },
        ],
        totalArrivals: 1,
        arrivalTypes: [],
      }),
    )
  })

  it('passes arrivalType query params to the service and marks matching checkboxes as checked', async () => {
    const controller = new RecentArrivalsController({ auditService, csraService } as any)

    const req = { id: 'req-id-2', query: { arrivalType: ['NEW_ADMISSION', 'TRANSFER_IN'] } } as any
    const res = {
      locals: {
        user: { username: 'USER2' },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'MDI' } } },
      },
      render: jest.fn(),
    } as any

    await controller.index(req, res, jest.fn())

    expect(csraService.getRecentArrivals).toHaveBeenCalledWith('USER2', 'MDI', {
      days: 3,
      arrivalTypes: ['NEW_ADMISSION', 'TRANSFER_IN'],
    })

    expect(res.render).toHaveBeenCalledWith(
      'pages/recentArrivals',
      expect.objectContaining({
        arrivalTypeOptions: expect.arrayContaining([
          { value: 'NEW_ADMISSION', text: 'New admissions (1)', checked: true },
          { value: 'TRANSFER_IN', text: 'Transfers in (0)', checked: true },
          { value: 'COURT_RETURN', text: 'Court returns (0)', checked: false },
          { value: 'TEMPORARY_ABSENCE_RETURN', text: 'Temporary absence returns (0)', checked: false },
        ]),
        totalArrivals: 1,
        arrivalTypes: ['NEW_ADMISSION', 'TRANSFER_IN'],
      }),
    )
  })

  it('passes a single arrivalType query param (not an array) to the service', async () => {
    const controller = new RecentArrivalsController({ auditService, csraService } as any)

    const req = { id: 'req-id-3', query: { arrivalType: 'COURT_RETURN' } } as any
    const res = {
      locals: {
        user: { username: 'USER3' },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'LEI' } } },
      },
      render: jest.fn(),
    } as any

    await controller.index(req, res, jest.fn())

    expect(csraService.getRecentArrivals).toHaveBeenCalledWith('USER3', 'LEI', {
      days: 3,
      arrivalTypes: ['COURT_RETURN'],
    })
  })

  it('calls next with error when the service rejects', async () => {
    const controller = new RecentArrivalsController({ auditService, csraService } as any)
    const error = new Error('API down')
    csraService.getRecentArrivals.mockRejectedValue(error)

    const req = { id: 'req-id-4', query: {} } as any
    const res = {
      locals: {
        user: { username: 'USER4' },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'LEI' } } },
      },
      render: jest.fn(),
    } as any
    const next = jest.fn()

    await controller.index(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
    expect(res.render).not.toHaveBeenCalled()
  })
})
