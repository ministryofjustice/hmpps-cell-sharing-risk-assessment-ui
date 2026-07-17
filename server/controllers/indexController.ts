import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'

type Dependencies = Pick<Services, 'auditService'>

export default function indexController({ auditService }: Dependencies): RequestHandler {
  return async (req, res) => {
    await auditService.logPageView(Page.INDEX, { who: res.locals.user.username, correlationId: req.id })

    return res.render('pages/index', {
      title: 'Cell sharing risk assessment (CSRA)',
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
      establishmentName: res.locals.feComponents?.sharedData?.activeCaseLoad?.description ?? 'Unknown establishment',
      stats: {
        // TODO: Replace with real stats when available
        noRating: 3,
        highRisk: 217,
        standardRisk: 795,
      },
    })
  }
}
