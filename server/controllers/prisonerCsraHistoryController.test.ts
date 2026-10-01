import type { Request, Response } from 'express'
import PrisonerCsraHistoryController from './prisonerCsraHistoryController'

describe('PrisonerCsraHistoryController', () => {
  const auditService = { logPageView: jest.fn().mockResolvedValue(null) }
  const csraService = { getHistory: jest.fn() }
  const manageUsersService = { getUserDetails: jest.fn() }

  const controller = () => new PrisonerCsraHistoryController({ auditService, csraService, manageUsersService } as any)

  const request = (query: Request['query']) =>
    ({
      params: { prisonerNumber: 'A1234BC' },
      query,
      id: 'request-id-123',
    }) as unknown as Request<{ prisonerNumber: string }>

  const response = () =>
    ({
      locals: {
        user: { username: 'user1' },
        prisoner: { prisonerNumber: 'A1234BC' },
      },
      render: jest.fn(),
    }) as unknown as Response

  beforeEach(() => {
    jest.clearAllMocks()
    csraService.getHistory.mockResolvedValue({
      summary: {
        totalCsras: 1,
        highCount: 1,
        standardCount: 0,
        firstAssessmentDate: '2024-01-01',
        lastAssessmentDate: '2024-01-01',
        lastHighDate: '2024-01-01',
        ratings: ['HIGH'],
        establishments: [{ prisonId: 'LEI', prisonName: 'Leeds (HMP)' }],
      },
      content: [],
      page: 0,
      size: 10,
      totalElements: 0,
      totalPages: 0,
    })
  })

  it.each([
    {
      invalidDate: 'fromDate',
      query: {
        ratings: 'HIGH',
        establishments: 'LEI',
        fromDate: 'not-a-date',
        toDate: '31/1/2025',
      },
      expected: {
        page: '0',
        size: '10',
        ratings: ['HIGH'],
        establishments: ['LEI'],
        fromDate: undefined,
        toDate: '2025-01-31',
      },
    },
    {
      invalidDate: 'toDate',
      query: {
        ratings: 'HIGH',
        establishments: 'LEI',
        fromDate: '1/1/2025',
        toDate: 'not-a-date',
      },
      expected: {
        page: '0',
        size: '10',
        ratings: ['HIGH'],
        establishments: ['LEI'],
        fromDate: '2025-01-01',
        toDate: undefined,
      },
    },
  ])('keeps valid filters when $invalidDate is invalid', async ({ invalidDate, query, expected }) => {
    const res = response()

    await controller().index(request(query), res, jest.fn())

    expect(csraService.getHistory).toHaveBeenCalledWith('user1', 'A1234BC', expected)
    expect(res.locals.validationErrors).toHaveProperty(invalidDate)
    expect(res.render).toHaveBeenCalledWith(
      'pages/prisonerCsraHistory',
      expect.objectContaining({
        filters: {
          ratings: ['HIGH'],
          establishments: ['LEI'],
          fromDate: query.fromDate,
          toDate: query.toDate,
        },
      }),
    )
  })

  it('resolves interim reviewer display names', async () => {
    csraService.getHistory.mockResolvedValue({
      summary: {
        totalCsras: 1,
        highCount: 1,
        standardCount: 0,
        firstAssessmentDate: '2024-01-01',
        lastAssessmentDate: '2024-01-01',
        lastHighDate: '2024-01-01',
        ratings: ['HIGH_GENERAL'],
        establishments: [{ prisonId: 'LEI', prisonName: 'Leeds (HMP)' }],
      },
      content: [{ interimReviewer: 'NQP56Y' }],
      page: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
    })
    manageUsersService.getUserDetails.mockResolvedValue({ name: 'Neil Reviewer' })
    const res = response()

    await controller().index(request({}), res, jest.fn())

    expect(manageUsersService.getUserDetails).toHaveBeenCalledWith('user1', 'NQP56Y')
    expect(res.locals.userDisplayNames.get('NQP56Y')).toBe('Neil Reviewer')
  })
})
