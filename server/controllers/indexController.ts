import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import { canAdminister } from '../middleware/requireAdminRole'
import logger from '../../logger'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export default class IndexController {
  constructor(private readonly dependencies: Dependencies) {}

  index: RequestHandler = async (req, res) => {
    const { auditService, csraService } = this.dependencies
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

    // These tiles all lead to read-only worklists, which any user may see for prisoners in their
    // caseload — the same information already on the DPS prisoner profile. They are deliberately not
    // gated on the establishment being switched on for CSRA in DPS: with data migrated and kept in
    // two-way sync with NOMIS, it is accurate whichever system the prison records in. Rollout gates
    // writes, not reads.
    return res.render('pages/index', {
      title: 'Cell sharing risk assessment (CSRA)',
      isAdmin: canAdminister(res.locals.user.userRoles),
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
