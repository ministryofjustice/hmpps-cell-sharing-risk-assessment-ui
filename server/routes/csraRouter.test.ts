import request from 'supertest'

import { appWithAllRoutes, user } from './testutils/appSetup'
import type { Prisoner } from '../data/prisonerSearchApiTypes'
import { Role } from '../utils/roles'

const prisoner: Prisoner = {
  prisonerNumber: 'A1234BC',
  firstName: 'JOHN',
  lastName: 'SMITH',
  prisonId: 'LEI',
  prisonName: 'Leeds (HMP)',
}

describe('csraRouter', () => {
  const auditService = { logPageView: jest.fn().mockResolvedValue(null) }
  const csraService = {
    getCsraAssessment: jest.fn(),
    startCsraAssessment: jest.fn(),
  }
  const prisonerSearchService = {
    getPrisoner: jest.fn(),
  }
  const manageUsersService = {
    getUserCaseloads: jest.fn(),
  }
  const prisonApiService = {} as never
  const activeAgenciesService = {
    getActiveAgencyIds: jest.fn(),
    isPrisonActive: jest.fn(),
    invalidate: jest.fn(),
  }

  const buildApp = (roles: string[]) =>
    appWithAllRoutes({
      services: {
        auditService,
        csraService,
        prisonerSearchService,
        manageUsersService,
        prisonApiService,
        activeAgenciesService,
      } as any,
      userSupplier: () => ({ ...user, userRoles: roles }),
    })

  beforeEach(() => {
    jest.clearAllMocks()
    prisonerSearchService.getPrisoner.mockResolvedValue(prisoner)
    manageUsersService.getUserCaseloads.mockResolvedValue({
      username: user.username,
      active: true,
      accountType: 'GENERAL',
      activeCaseload: { id: 'LEI', name: 'Leeds (HMP)' },
      caseloads: [{ id: 'LEI', name: 'Leeds (HMP)' }],
    })
    csraService.startCsraAssessment.mockResolvedValue({ assessmentId: 'assessment-123' })
  })

  it('blocks CSRA routes when the user lacks the assessment edit role', async () => {
    await request(buildApp([])).get('/prisoner/A1234BC/csra/start').expect(302).expect('Location', '/sign-out')

    expect(csraService.startCsraAssessment).not.toHaveBeenCalled()
  })

  it('allows CSRA routes when the user has the assessment edit role', async () => {
    await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get('/prisoner/A1234BC/csra/start')
      .expect(302)
      .expect('Location', '/prisoner/A1234BC/csra/assessment-123')

    expect(csraService.startCsraAssessment).toHaveBeenCalledWith('user1', 'A1234BC', undefined)
  })
})
