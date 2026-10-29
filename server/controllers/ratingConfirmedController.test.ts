import type { Request, Response } from 'express'
import ratingConfirmedController from './ratingConfirmedController'
import { Page } from '../services/auditService'
import type { CsraCurrentRating } from '../data/csraApiTypes'

describe('ratingConfirmedController', () => {
  const auditService = { logPageView: jest.fn().mockResolvedValue(null) }
  const csraService = { getCurrentRating: jest.fn() }

  const controller = ratingConfirmedController({ auditService, csraService } as any)

  const request = () =>
    ({
      params: { prisonerNumber: 'A1234BC' },
      id: 'request-id-123',
    }) as unknown as Request<{ prisonerNumber: string }>

  const response = () =>
    ({
      locals: {
        user: { username: 'user1' },
        prisoner: { prisonerNumber: 'A1234BC', firstName: 'JOHN' },
      },
      render: jest.fn(),
    }) as unknown as Response

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('logs the page view, loads the current rating and renders the confirmation', async () => {
    const csra: CsraCurrentRating = {
      prisonerNumber: 'A1234BC',
      status: 'PROVISIONAL',
      rating: 'HIGH_SPECIFIC',
      provisional: true,
      ratingStage: 'PROVISIONAL',
      riskTo: [],
      vulnerabilities: [],
    }
    csraService.getCurrentRating.mockResolvedValue(csra)
    const res = response()

    await controller(request(), res, jest.fn())

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.RATING_CONFIRMED, {
      who: 'user1',
      subjectId: 'A1234BC',
      subjectType: 'PRISONER_ID',
      correlationId: 'request-id-123',
    })
    expect(csraService.getCurrentRating).toHaveBeenCalledWith('user1', 'A1234BC')
    expect(res.render).toHaveBeenCalledWith('pages/ratingConfirmed', {
      prisoner: res.locals.prisoner,
      csra,
      cancelLink: '/prisoner/A1234BC',
    })
  })
})
