import indexController from './indexController'
import { Page } from '../services/auditService'
import { Role } from '../utils/roles'

describe('indexController', () => {
  const csraService = {
    getRatingSummary: jest.fn(),
  }

  const activeAgenciesService = {
    isPrisonActive: jest.fn(),
  }

  const auditService = {
    logPageView: jest.fn(),
  }

  const controller = () => indexController({ auditService, csraService, activeAgenciesService } as any)

  const request = (id = 'request-id-123') => ({ id }) as any

  const response = ({
    username = 'user1',
    userRoles = [] as string[],
    // null (not undefined) means "no active caseload" — an explicit undefined would take the default.
    caseLoad = { caseLoadId: 'MDI', description: 'Leeds (HMP)' } as Record<string, string> | null,
  } = {}) =>
    ({
      locals: {
        user: { username, userRoles },
        feComponents: caseLoad ? { sharedData: { activeCaseLoad: caseLoad } } : undefined,
      },
      render: jest.fn(),
    }) as any

  beforeEach(() => {
    jest.clearAllMocks()
    auditService.logPageView.mockResolvedValue(null)
    activeAgenciesService.isPrisonActive.mockResolvedValue(true)
    csraService.getRatingSummary.mockResolvedValue({
      prisonId: 'MDI',
      total: 1015,
      noRating: 0,
      highRisk: 217,
      standardRisk: 795,
    })
  })

  it('renders the index page with expected locals', async () => {
    const res = response()

    await controller()(request(), res, jest.fn())

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.INDEX, {
      who: 'user1',
      correlationId: 'request-id-123',
    })

    expect(res.render).toHaveBeenCalledWith('pages/index', {
      title: 'Cell sharing risk assessment (CSRA)',
      establishmentName: 'Leeds (HMP)',
      prisonActive: true,
      isAdmin: false,
      cardsSections: [
        {
          subheading: 'Start and complete assessments',
          cards: [
            {
              heading: 'Recent arrivals',
              description: 'View recently arrived prisoners who may need an assessment.',
              href: '/recent-arrivals',
              clickable: true,
            },
            {
              heading: 'Assessments in progress',
              description: 'View prisoners who have an assessment in progress.',
              href: '/assessments-in-progress',
              clickable: true,
            },
          ],
        },
        {
          subheading: 'View upcoming and incomplete reviews',
          cards: [
            {
              heading: 'High risk prisoners due for review',
              description: 'View prisoners with a scheduled cell sharing risk review.',
              href: '/due-for-review',
              clickable: true,
            },
            {
              heading: 'Reviews in progress',
              description: 'View incomplete cell sharing risk reviews for prisoners.',
              href: '/reviews-in-progress',
              clickable: true,
            },
          ],
        },
      ],
      stats: {
        noRating: '0',
        highRisk: '217',
        standardRisk: '795',
      },
    })

    const renderLocals = res.render.mock.calls[0][1]
    expect(renderLocals.cardsSections).toHaveLength(2)
    expect(renderLocals.cardsSections[0].subheading).toBe('Start and complete assessments')
    expect(renderLocals.cardsSections[1].subheading).toBe('View upcoming and incomplete reviews')
  })

  it('falls back to Unknown establishment when active case load is unavailable', async () => {
    const res = response({ username: 'user2', caseLoad: null })

    await controller()(request('request-id-456'), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/index',
      expect.objectContaining({
        establishmentName: 'Unknown establishment',
      }),
    )
  })

  it('unlinks the journey tiles when the establishment is not yet switched on in DPS', async () => {
    activeAgenciesService.isPrisonActive.mockResolvedValue(false)
    const res = response()

    await controller()(request(), res, jest.fn())

    const renderLocals = res.render.mock.calls[0][1]
    expect(renderLocals.prisonActive).toBe(false)
    const journeyCards = renderLocals.cardsSections.flatMap((section: { cards: unknown[] }) => section.cards)
    expect(journeyCards).toHaveLength(4)
    journeyCards.forEach((card: { href?: string; clickable: boolean }) => {
      expect(card.href).toBeUndefined()
      expect(card.clickable).toBe(false)
    })
  })

  it('checks rollout against the active caseload', async () => {
    await controller()(request(), response(), jest.fn())

    expect(activeAgenciesService.isPrisonActive).toHaveBeenCalledWith('MDI')
  })

  it('shows the admin tile only to a user with the admin role', async () => {
    const res = response({ userRoles: [Role.CSRA__ADMIN] })

    await controller()(request(), res, jest.fn())

    const renderLocals = res.render.mock.calls[0][1]
    expect(renderLocals.isAdmin).toBe(true)
    expect(renderLocals.cardsSections).toHaveLength(3)
    expect(renderLocals.cardsSections[2]).toEqual({
      subheading: 'Admin',
      cards: [
        {
          heading: 'Manage enabled prisons',
          description: 'Switch CSRA on or off for a prison and control the NOMIS CSRA screen.',
          href: '/admin/prisons',
          clickable: true,
          'data-qa': 'admin-card',
        },
      ],
    })
  })
})
