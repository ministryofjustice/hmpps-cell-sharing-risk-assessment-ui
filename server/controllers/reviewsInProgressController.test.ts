import { Request, Response } from 'express'
import ReviewsInProgressController from './reviewsInProgressController'
import { Page } from '../services/auditService'

describe('reviewsInProgressController', () => {
  let auditService: { logPageView: jest.Mock }
  let csraService: { getReviewsInProgress: jest.Mock }
  let manageUsersService: { getUserDetails: jest.Mock }
  const expectedReviewsInProgress = {
    content: [
      {
        reviewId: 'de91dfa7-821f-4552-a427-bf2f32eafeb0',
        prisonerNumber: 'A9354JF',
        firstName: 'Simon',
        lastName: 'Kettleby',
        startedOn: '2026-07-03',
        startedBy: 'SCARTER',
      },
      {
        reviewId: '37a1a223-cf3c-4dbf-b955-e63445574dd5',
        prisonerNumber: 'A7647NR',
        firstName: 'Gareth',
        lastName: 'Winrow',
        startedOn: '2026-07-06',
        startedBy: 'MSTANLEY',
      },
    ],
    totalResults: 2,
  }

  beforeEach(() => {
    auditService = {
      logPageView: jest.fn().mockResolvedValue(null),
    }

    csraService = {
      getReviewsInProgress: jest.fn().mockResolvedValue(expectedReviewsInProgress),
    }

    manageUsersService = {
      getUserDetails: jest.fn().mockImplementation((_: string, username: string) => {
        if (username === 'SCARTER') return Promise.resolve({ name: 'Sue Carter' })
        if (username === 'MSTANLEY') return Promise.resolve({ name: 'Mia Stanley' })
        return Promise.resolve({ name: username })
      }),
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('stores display names in res.locals and only looks up each username once', async () => {
    const controller = new ReviewsInProgressController({ auditService, csraService, manageUsersService } as any)

    const req = { id: 'request-id-123' } as any
    const res = {
      locals: {
        user: { username: 'USER1', token: 'token-1' },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'MDI' } } },
      },
      render: jest.fn(),
    } as any

    await controller.index(req, res, jest.fn())

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.REVIEWS_IN_PROGRESS, {
      who: 'USER1',
      correlationId: 'request-id-123',
    })

    expect(csraService.getReviewsInProgress).toHaveBeenCalledWith('USER1', 'MDI')

    expect(manageUsersService.getUserDetails).toHaveBeenCalledTimes(2)
    expect(manageUsersService.getUserDetails).toHaveBeenCalledWith('USER1', 'SCARTER')
    expect(manageUsersService.getUserDetails).toHaveBeenCalledWith('USER1', 'MSTANLEY')

    expect(res.locals.userDisplayNames).toBeInstanceOf(Map)
    expect(res.locals.userDisplayNames.get('SCARTER')).toBe('Sue Carter')
    expect(res.locals.userDisplayNames.get('MSTANLEY')).toBe('Mia Stanley')

    expect(res.render).toHaveBeenCalledWith(
      'pages/reviewsInProgress',
      expect.objectContaining({
        reviewsInProgress: expectedReviewsInProgress.content,
      }),
    )
  })

  it('falls back to username if a Manage Users lookup fails', async () => {
    manageUsersService.getUserDetails = jest.fn().mockImplementation((_: string, username: string) => {
      if (username === 'MSTANLEY') return Promise.reject(new Error('Lookup failed'))
      return Promise.resolve({ name: 'Sue Carter' })
    })

    const controller = new ReviewsInProgressController({ auditService, csraService, manageUsersService } as any)

    const req = { id: 'request-id-456' } as any
    const res = {
      locals: {
        user: { username: 'USER2', token: 'token-2' },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'LEI' } } },
      },
      render: jest.fn(),
    } as any

    await controller.index(req, res, jest.fn())

    expect(res.locals.userDisplayNames.get('SCARTER')).toBe('Sue Carter')
    expect(res.locals.userDisplayNames.has('MSTANLEY')).toBe(false)

    expect(res.render).toHaveBeenCalledWith(
      'pages/reviewsInProgress',
      expect.objectContaining({
        reviewsInProgress: expectedReviewsInProgress.content,
      }),
    )
  })

  it('passes true for canEditReviews when the user has the role', async () => {
    const res = {
      locals: {
        user: { username: 'USER2', token: 'token-2', userRoles: ['CSRA__REVIEW_EDIT'] },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'LEI' } } },
      },
      render: jest.fn(),
    } as unknown as Response

    const controller = new ReviewsInProgressController({ auditService, csraService, manageUsersService } as any)
    await controller.index({} as Request, res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/reviewsInProgress',
      expect.objectContaining({
        canEditReviews: true,
      }),
    )
  })

  it('passes false for canEditReviews when the user does not have the role', async () => {
    const res = {
      locals: {
        user: { username: 'USER2', token: 'token-2', userRoles: [] },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'LEI' } } },
      },
      render: jest.fn(),
    } as unknown as Response

    const controller = new ReviewsInProgressController({ auditService, csraService, manageUsersService } as any)
    await controller.index({} as Request, res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/reviewsInProgress',
      expect.objectContaining({
        canEditReviews: false,
      }),
    )
  })
})
