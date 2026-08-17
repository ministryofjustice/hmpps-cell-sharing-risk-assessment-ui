import { Request, Response } from 'express'
import AssessmentsInProgressController from './assessmentsInProgressController'
import { Page } from '../services/auditService'

describe('assessmentsInProgressController', () => {
  let auditService: { logPageView: jest.Mock }
  let csraService: { getAssessmentsInProgress: jest.Mock }
  let manageUsersService: { getUserDetails: jest.Mock }
  const expectedAssessmentsInProgress = {
    assessmentStarted: [
      {
        reviewId: 'de91dfa7-821f-4552-a427-bf2f32eafeb0',
        prisonerNumber: 'A9354JF',
        firstName: 'Simon',
        lastName: 'Kettleby',
        startedOn: '2026-07-06',
        startedBy: 'JBLOGGS',
      },
      {
        reviewId: '37a1a223-cf3c-4dbf-b955-e63445574dd5',
        prisonerNumber: 'A1234BC',
        firstName: 'John',
        lastName: 'Smith',
        startedOn: '2026-07-07',
        startedBy: 'JBLOGGS',
      },
    ],
    provisionalRatingEntered: [
      {
        reviewId: '6a4fa388-3aae-4c9f-8fc7-fb85ac2ed27f',
        prisonerNumber: 'A5197BD',
        firstName: 'Daniel',
        lastName: 'Havers',
        assessedOn: '2026-07-06',
        assessedBy: 'MSTANLEY',
        rating: 'HIGH_SPECIFIC',
      },
    ],
  }

  beforeEach(() => {
    auditService = {
      logPageView: jest.fn().mockResolvedValue(null),
    }

    csraService = {
      getAssessmentsInProgress: jest.fn().mockResolvedValue(expectedAssessmentsInProgress),
    }

    manageUsersService = {
      getUserDetails: jest.fn().mockImplementation((_: string, username: string) => {
        if (username === 'JBLOGGS') return Promise.resolve({ name: 'Joe Bloggs' })
        if (username === 'MSTANLEY') return Promise.resolve({ name: 'Mia Stanley' })
        return Promise.resolve({ name: username })
      }),
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('stores display names in res.locals and only looks up each username once', async () => {
    const controller = new AssessmentsInProgressController({ auditService, csraService, manageUsersService } as any)

    const req = { id: 'request-id-123' } as any
    const res = {
      locals: {
        user: { username: 'USER1', token: 'token-1' },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'MDI' } } },
      },
      render: jest.fn(),
    } as any

    await controller.index(req, res, jest.fn())

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.ASSESSMENTS_IN_PROGRESS, {
      who: 'USER1',
      correlationId: 'request-id-123',
    })

    expect(manageUsersService.getUserDetails).toHaveBeenCalledTimes(2)
    expect(manageUsersService.getUserDetails).toHaveBeenCalledWith('USER1', 'JBLOGGS')
    expect(manageUsersService.getUserDetails).toHaveBeenCalledWith('USER1', 'MSTANLEY')

    expect(res.locals.userDisplayNames).toBeInstanceOf(Map)
    expect(res.locals.userDisplayNames.get('JBLOGGS')).toBe('Joe Bloggs')
    expect(res.locals.userDisplayNames.get('MSTANLEY')).toBe('Mia Stanley')

    expect(res.render).toHaveBeenCalledWith(
      'pages/assessmentsInProgress',
      expect.objectContaining({
        assessmentStarted: expectedAssessmentsInProgress.assessmentStarted,
        provisionalRatingEntered: expectedAssessmentsInProgress.provisionalRatingEntered,
      }),
    )
  })

  it('falls back to username if a Manage Users lookup fails', async () => {
    manageUsersService.getUserDetails = jest.fn().mockImplementation((_: string, username: string) => {
      if (username === 'MSTANLEY') return Promise.reject(new Error('Lookup failed'))
      return Promise.resolve({ name: 'Joe Bloggs' })
    })

    const controller = new AssessmentsInProgressController({ auditService, csraService, manageUsersService } as any)

    const req = { id: 'request-id-456' } as any
    const res = {
      locals: {
        user: { username: 'USER2', token: 'token-2' },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'LEI' } } },
      },
      render: jest.fn(),
    } as any

    await controller.index(req, res, jest.fn())

    expect(res.locals.userDisplayNames.get('JBLOGGS')).toBe('Joe Bloggs')
    expect(res.locals.userDisplayNames.has('MSTANLEY')).toBe(false)

    expect(res.render).toHaveBeenCalledWith(
      'pages/assessmentsInProgress',
      expect.objectContaining({
        provisionalRatingEntered: expectedAssessmentsInProgress.provisionalRatingEntered,
      }),
    )
  })

  it('passes true for canEditAssessments when the user has the role', async () => {
    const res = {
      locals: {
        user: { username: 'USER2', token: 'token-2', userRoles: ['CSRA__ASSESSMENT_EDIT'] },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'LEI' } } },
      },
      render: jest.fn(),
    } as unknown as Response

    const controller = new AssessmentsInProgressController({ auditService, csraService, manageUsersService } as any)
    await controller.index({} as Request, res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/assessmentsInProgress',
      expect.objectContaining({
        canEditAssessments: true,
      }),
    )
  })

  it('passes false for canEditAssessments when the user does not have the role', async () => {
    const res = {
      locals: {
        user: { username: 'USER2', token: 'token-2', userRoles: [] },
        feComponents: { sharedData: { activeCaseLoad: { caseLoadId: 'LEI' } } },
      },
      render: jest.fn(),
    } as unknown as Response

    const controller = new AssessmentsInProgressController({ auditService, csraService, manageUsersService } as any)
    await controller.index({} as Request, res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/assessmentsInProgress',
      expect.objectContaining({
        canEditAssessments: false,
      }),
    )
  })
})
