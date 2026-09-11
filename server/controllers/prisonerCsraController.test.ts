import type { Request, Response } from 'express'
import PrisonerCsraController from './prisonerCsraController'
import { Page } from '../services/auditService'

describe('PrisonerCsraController', () => {
  const auditService = { logPageView: jest.fn().mockResolvedValue(null) }
  const csraService = { getCurrentRating: jest.fn() }
  const manageUsersService = { getUserDetails: jest.fn() }

  const controller = () => new PrisonerCsraController({ auditService, csraService, manageUsersService } as any)

  const request = (prisonerNumber = 'A1234BC') =>
    ({
      params: { prisonerNumber },
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
  })

  it('logs the page view and renders the current CSRA without a user-name lookup when not in progress', async () => {
    csraService.getCurrentRating.mockResolvedValue({
      prisonerNumber: 'A1234BC',
      status: 'COMPLETE',
      rating: 'HIGH',
      provisional: false,
      riskTo: [],
      vulnerabilities: [],
    })
    const res = response()

    await controller().index(request(), res, jest.fn())

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.PRISONER_CSRA, {
      who: 'user1',
      subjectId: 'A1234BC',
      subjectType: 'PRISONER_ID',
      correlationId: 'request-id-123',
    })
    expect(csraService.getCurrentRating).toHaveBeenCalledWith('user1', 'A1234BC')
    expect(manageUsersService.getUserDetails).not.toHaveBeenCalled()
    expect(res.render).toHaveBeenCalledWith(
      'pages/prisonerCsra',
      expect.objectContaining({
        prisonerNumber: 'A1234BC',
        prisoner: res.locals.prisoner,
      }),
    )
  })

  it('looks up a display name when the current rating is in progress', async () => {
    csraService.getCurrentRating.mockResolvedValue({
      prisonerNumber: 'A1234BC',
      status: 'IN_PROGRESS',
      rating: 'STANDARD',
      provisional: false,
      riskTo: [],
      vulnerabilities: [],
      inProgress: {
        reviewId: 'review-123',
        type: 'CSRA_INITIAL_REVIEW',
        startedBy: 'JBLOGGS',
        startedAt: '2026-08-01T09:00:00',
      },
    })
    manageUsersService.getUserDetails.mockResolvedValue({ name: 'Joe Bloggs' })
    const res = response()

    await controller().index(request(), res, jest.fn())

    expect(manageUsersService.getUserDetails).toHaveBeenCalledWith('user1', 'JBLOGGS')
    expect(res.locals.userDisplayNames).toBeInstanceOf(Map)
    expect(res.locals.userDisplayNames.get('JBLOGGS')).toBe('Joe Bloggs')
    expect(res.render).toHaveBeenCalledWith(
      'pages/prisonerCsra',
      expect.objectContaining({
        prisonerNumber: 'A1234BC',
      }),
    )
  })
})
