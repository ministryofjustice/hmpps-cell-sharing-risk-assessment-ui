import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { AdminAction, Page } from '../services/auditService'
import {
  isNomisScreenState,
  NOMIS_CSRA_MODULES,
  NomisScreenNotSetUpError,
  nomisStateSuccessMessage,
} from '../utils/nomisSplash'

type Dependencies = Pick<Services, 'auditService' | 'csraService' | 'prisonApiService' | 'activeAgenciesService'>

/** Redirect back to the console, keeping the admin on the same filtered view they acted from. */
const backToList = (search: unknown): string => {
  const params = new URLSearchParams()
  if (typeof search === 'string' && search) params.set('q', search)
  const query = params.toString()
  return `/admin/prisons${query ? `?${query}` : ''}`
}

/**
 * The rollout admin console: which prisons use CSRA in DPS, and the state of the legacy NOMIS CSRA
 * screen for each. Not caseload-scoped — it is a national control, gated on the admin role.
 */
export function adminPrisonsListController({
  auditService,
  csraService,
  prisonApiService,
}: Dependencies): RequestHandler {
  return async (req, res) => {
    const { username } = res.locals.user
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : ''

    // The DPS active list drives one column, the NOMIS screen states the other. The NOMIS read
    // degrades to null so a splash screen that is missing (or a missing role) never 500s the page.
    const [agencies, nomisStates] = await Promise.all([
      csraService.getAllAgencies(username),
      prisonApiService.getNomisScreenStates(username),
    ])

    const needle = search.toLowerCase()
    const filtered = (
      needle
        ? agencies.filter(
            agency => agency.name.toLowerCase().includes(needle) || agency.agencyId.toLowerCase().includes(needle),
          )
        : agencies
    ).map(agency => ({ ...agency, nomisState: nomisStates?.get(agency.agencyId) ?? 'NORMAL' }))

    await auditService.logPageView(Page.ADMIN_PRISONS, { who: username, correlationId: req.id })

    return res.render('pages/admin/prisons', {
      title: 'Manage enabled prisons',
      backLink: '/',
      backLinkText: 'Back to CSRA',
      agencies: filtered,
      search,
      nomisScreenAvailable: nomisStates !== null,
      nomisModules: NOMIS_CSRA_MODULES.join(', '),
      activeCount: agencies.filter(agency => agency.active).length,
      totalCount: agencies.length,
      successMessage: req.flash('success')[0],
      errorMessage: req.flash('error')[0],
    })
  }
}

/** Switch CSRA on or off in DPS for one prison. */
export function adminSetPrisonActiveController({
  auditService,
  csraService,
  activeAgenciesService,
}: Dependencies): RequestHandler {
  return async (req, res) => {
    const { username } = res.locals.user
    const agencyId = String(req.params.agencyId)
    const active = req.body.active === 'true'
    const name = typeof req.body.name === 'string' && req.body.name ? req.body.name : agencyId

    await csraService.setAgencyActive(username, agencyId, active)
    // Drop the cached active-prison set so this pod reflects the toggle immediately; other pods
    // converge on the TTL. Keeps the write gate in step with what the admin just changed.
    activeAgenciesService.invalidate()

    await auditService.logAuditEvent({
      what: AdminAction.SET_PRISON_ACTIVE,
      who: username,
      subjectId: agencyId,
      subjectType: 'PRISON_ID',
      correlationId: req.id,
      details: { active },
    })

    req.flash('success', `CSRA is now switched ${active ? 'on' : 'off'} for ${name}.`)
    return res.redirect(backToList(req.body.q))
  }
}

/**
 * Move a prison's legacy NOMIS CSRA screen to Normal, Warning or Blocked. Deliberately independent of
 * the DPS toggle above so each rollout step stays an explicit decision.
 */
export function adminSetNomisScreenController({ auditService, prisonApiService }: Dependencies): RequestHandler {
  return async (req, res) => {
    const { username } = res.locals.user
    const agencyId = String(req.params.agencyId)
    const name = typeof req.body.name === 'string' && req.body.name ? req.body.name : agencyId
    const { state } = req.body

    if (!isNomisScreenState(state)) {
      req.flash('error', 'Select a valid NOMIS CSRA screen state.')
      return res.redirect(backToList(req.body.q))
    }

    try {
      await prisonApiService.setNomisScreenState(username, agencyId, state)
    } catch (error) {
      if (error instanceof NomisScreenNotSetUpError) {
        req.flash(
          'error',
          `The NOMIS splash screen has not been set up yet for ${error.missingModules.join(', ')}. ` +
            'Create it before changing prison access.',
        )
        return res.redirect(backToList(req.body.q))
      }
      throw error
    }

    await auditService.logAuditEvent({
      what: AdminAction.SET_NOMIS_CSRA_SCREEN,
      who: username,
      subjectId: agencyId,
      subjectType: 'PRISON_ID',
      correlationId: req.id,
      details: { state },
    })

    req.flash('success', nomisStateSuccessMessage(name, state))
    return res.redirect(backToList(req.body.q))
  }
}
