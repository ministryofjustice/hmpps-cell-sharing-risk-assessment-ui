import indexController from './indexController'
import { Page } from '../services/auditService'

describe('indexController', () => {
  const csraService = {
    getRatingSummary: jest.fn().mockResolvedValue({
      prisonId: 'MDI',
      total: 1015,
      noRating: 3,
      highRisk: 217,
      standardRisk: 795,
    }),
  }

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('renders the index page with expected locals', async () => {
    const auditService = {
      logPageView: jest.fn().mockResolvedValue(null),
    }

    const controller = indexController({ auditService, csraService } as any)

    const req = {
      id: 'request-id-123',
    } as any
    const res = {
      locals: {
        user: { username: 'user1' },
        feComponents: {
          sharedData: {
            activeCaseLoad: {
              description: 'Leeds (HMP)',
            },
          },
        },
      },
      render: jest.fn(),
    } as any

    await controller(req, res, jest.fn())

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.INDEX, {
      who: 'user1',
      correlationId: 'request-id-123',
    })

    expect(res.render).toHaveBeenCalledWith('pages/index', {
      title: 'Cell sharing risk assessment (CSRA)',
      establishmentName: 'Leeds (HMP)',
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
              description: 'Continue incomplete cell sharing risk reviews for prisoners.',
              href: '/reviews-in-progress',
              clickable: true,
            },
          ],
        },
      ],
      stats: {
        prisonId: 'MDI',
        total: 1015,
        noRating: 3,
        highRisk: 217,
        standardRisk: 795,
      },
    })

    const renderLocals = res.render.mock.calls[0][1]
    expect(renderLocals.cardsSections).toHaveLength(2)
    expect(renderLocals.cardsSections[0].subheading).toBe('Start and complete assessments')
    expect(renderLocals.cardsSections[1].subheading).toBe('View upcoming and incomplete reviews')
  })

  it('falls back to Unknown establishment when active case load is unavailable', async () => {
    const auditService = {
      logPageView: jest.fn().mockResolvedValue(null),
    }

    const controller = indexController({ auditService, csraService } as any)

    const req = {
      id: 'request-id-456',
    } as any
    const res = {
      locals: {
        user: { username: 'user2' },
      },
      render: jest.fn(),
    } as any

    await controller(req, res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/index',
      expect.objectContaining({
        establishmentName: 'Unknown establishment',
      }),
    )
  })
})
