import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import { canAdminister } from '../middleware/requireAdminRole'
import logger from '../../logger'

type Dependencies = Pick<Services, 'auditService' | 'csraService' | 'activeAgenciesService'>

export default function indexController({
  auditService,
  csraService,
  activeAgenciesService,
}: Dependencies): RequestHandler {
  return async (req, res) => {
    await auditService.logPageView(Page.INDEX, { who: res.locals.user.username, correlationId: req.id })

    const activeCaseloadId = res.locals.feComponents?.sharedData?.activeCaseLoad?.caseLoadId

    let stats: { noRating: string | number; highRisk: string | number; standardRisk: string | number } = {
      noRating: '-',
      highRisk: '-',
      standardRisk: '-',
    }

    try {
      stats = await csraService.getRatingSummary(res.locals.user.username, activeCaseloadId)
    } catch (error) {
      logger.error('Error fetching prisoner ratings for index page', error)
    }

    // During rollout a prison uses either DPS or NOMIS for CSRA. Until this establishment is switched
    // on, the assessment/review journeys are not available here and the page says so instead.
    const prisonActive = await activeAgenciesService.isPrisonActive(activeCaseloadId)

    return res.render('pages/index', {
      title: 'Cell sharing risk assessment (CSRA)',
      prisonActive,
      isAdmin: canAdminister(res.locals.user.userRoles),
      cardsSections: [
        {
          subheading: 'Start and complete assessments',
          cards: [
            journeyCard({
              heading: 'Recent arrivals',
              description: 'View recently arrived prisoners who may need an assessment.',
              href: '/recent-arrivals',
              prisonActive,
            }),
            journeyCard({
              heading: 'Assessments in progress',
              description: 'View prisoners who have an assessment in progress.',
              href: '/assessments-in-progress',
              prisonActive,
            }),
          ],
        },
        {
          subheading: 'View upcoming and incomplete reviews',
          cards: [
            journeyCard({
              heading: 'High risk prisoners due for review',
              description: 'View prisoners with a scheduled cell sharing risk review.',
              href: '/due-for-review',
              prisonActive,
            }),
            journeyCard({
              heading: 'Reviews in progress',
              description: 'View incomplete cell sharing risk reviews for prisoners.',
              href: '/reviews-in-progress',
              prisonActive,
            }),
          ],
        },
        ...(canAdminister(res.locals.user.userRoles)
          ? [
              {
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
              },
            ]
          : []),
      ],
      establishmentName: res.locals.feComponents?.sharedData?.activeCaseLoad?.description ?? 'Unknown establishment',
      stats: {
        noRating: String(stats.noRating),
        highRisk: String(stats.highRisk),
        standardRisk: String(stats.standardRisk),
      },
    })
  }
}

/**
 * A CSRA journey tile. Until the establishment is switched on in DPS the journey does not exist here,
 * so the tile is shown without a link rather than hidden — staff can still see what is coming.
 */
function journeyCard({
  heading,
  description,
  href,
  prisonActive,
}: {
  heading: string
  description: string
  href: string
  prisonActive: boolean
}) {
  return {
    heading,
    description,
    href: prisonActive ? href : undefined,
    clickable: prisonActive,
  }
}
