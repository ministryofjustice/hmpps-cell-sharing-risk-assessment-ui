import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { AdminAction, Page } from '../services/auditService'
import {
  activeSuccessMessage,
  ALL_AGENCIES,
  approvalStepSuccessMessage,
  derivePrisonState,
  isNomisApprovalStep,
  NOMIS_AUTO_APPROVAL_SWITCH,
  NOMIS_CSRA_MODULES,
  NOMIS_CSRA_SWITCH,
  type NomisPrisonState,
  NomisPrisonOnDpsError,
  NomisScreenNotSetUpError,
  NomisSwitchNotSetUpError,
} from '../utils/nomisSplash'

type Dependencies = Pick<Services, 'auditService' | 'csraService' | 'prisonApiService' | 'activeAgenciesService'>

/** Redirect back to the console, keeping the admin on the same filtered view they acted from. */
const backToList = (search: unknown): string => {
  const params = new URLSearchParams()
  if (typeof search === 'string' && search) params.set('q', search)
  const query = params.toString()
  return `/admin/prisons${query ? `?${query}` : ''}`
}

/** The error banner for a missing splash screen, naming what to create in NOMIS. */
const screenNotSetUpMessage = (error: NomisScreenNotSetUpError): string =>
  `The NOMIS splash screen has not been set up yet for ${error.missingModules.join(', ')}. ` +
  'Create it in NOMIS first. Nothing has been changed.'

/**
 * The rollout admin console actions grouped in one controller class.
 */
export default class AdminPrisonsController {
  constructor(private readonly dependencies: Dependencies) {}

  /**
   * The rollout admin console: which prisons use CSRA in DPS, whether NOMIS matches, and the NOMIS
   * approval step for prisons still on NOMIS. Not caseload-scoped - it is a national control, gated on
   * the admin role.
   */
  list: RequestHandler = async (req, res) => {
    const { auditService, csraService, prisonApiService } = this.dependencies
    const { username } = res.locals.user
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : ''

    // The NOMIS read degrades to null so a splash screen that is missing (or a missing role) never
    // 500s the page.
    const [agencies, nomis] = await Promise.all([
      csraService.getAllAgencies(username),
      prisonApiService.getNomisReadings(username),
    ])
    const nomisState = (agencyId: string, active: boolean): NomisPrisonState =>
      nomis
        ? derivePrisonState(nomis.screens, nomis.switches, agencyId, active)
        : { approval: 'REQUIRED', matchesDps: true }

    const needle = search.toLowerCase()
    const filtered = (
      needle
        ? agencies.filter(
            agency => agency.name.toLowerCase().includes(needle) || agency.agencyId.toLowerCase().includes(needle),
          )
        : agencies
    ).map(agency => ({ ...agency, nomis: nomisState(agency.agencyId, agency.active) }))

    await auditService.logPageView(Page.ADMIN_PRISONS, { who: username, correlationId: req.id })

    return res.render('pages/admin/prisons', {
      title: 'Manage enabled prisons',
      backLink: '/',
      backLinkText: 'Back to CSRA',
      agencies: filtered,
      search,
      nomisScreenAvailable: nomis !== null,
      nomisModules: NOMIS_CSRA_MODULES.join(', '),
      // The switches exist only once Syscon CR 502 is applied to this NOMIS environment.
      nomisSwitchesAvailable: Boolean(nomis?.switches),
      nomisSwitches: [NOMIS_CSRA_SWITCH, NOMIS_AUTO_APPROVAL_SWITCH].join(', '),
      // Switched off for every prison at once in NOMIS, so a per-prison change would have no effect.
      approvalRemovedNationally: Boolean(nomis?.switches?.autoApproval.includes(ALL_AGENCIES)),
      activeCount: agencies.filter(agency => agency.active).length,
      totalCount: agencies.length,
      successMessage: req.flash('success')[0],
      errorMessage: req.flash('error')[0],
    })
  }

  /**
   * Turn CSRA on or off for one prison. One decision covering both systems: DPS is switched on or off,
   * and the NOMIS CSRA screens and header switch are blocked or opened to match.
   */
  setActive: RequestHandler = async (req, res) => {
    const { auditService, csraService, prisonApiService, activeAgenciesService } = this.dependencies
    const { username } = res.locals.user
    const agencyId = String(req.params.agencyId)
    const active = req.body.active === 'true'
    const name = typeof req.body.name === 'string' && req.body.name ? req.body.name : agencyId

    let change
    try {
      change = await prisonApiService.setPrisonOnDps(username, agencyId, active, async () => {
        await csraService.setAgencyActive(username, agencyId, active)
        // Apply the change to the cached active-prison set so this pod reflects it immediately; other
        // pods converge on the TTL. Keeps the write gate in step with what the admin just changed.
        await activeAgenciesService.applyAgencyChange(agencyId, active)
      })
    } catch (error) {
      if (!(error instanceof NomisScreenNotSetUpError)) throw error
      req.flash('error', screenNotSetUpMessage(error))
      return res.redirect(backToList(req.body.q))
    }

    await auditService.logAuditEvent({
      what: AdminAction.SET_PRISON_ACTIVE,
      who: username,
      subjectId: agencyId,
      subjectType: 'PRISON_ID',
      correlationId: req.id,
      details: { active, ...change },
    })

    req.flash('success', activeSuccessMessage(name, active))
    return res.redirect(backToList(req.body.q))
  }

  /**
   * Put a prison still on NOMIS on, or take it off, the NOMIS process with no approval step. Kept when
   * the prison is later turned on, so turning it off again returns it to the same process.
   */
  setApprovalStep: RequestHandler = async (req, res) => {
    const { auditService, prisonApiService } = this.dependencies
    const { username } = res.locals.user
    const agencyId = String(req.params.agencyId)
    const name = typeof req.body.name === 'string' && req.body.name ? req.body.name : agencyId
    const { approval } = req.body

    if (!isNomisApprovalStep(approval)) {
      req.flash('error', 'Select whether the NOMIS approval step is required.')
      return res.redirect(backToList(req.body.q))
    }

    let change
    try {
      change = await prisonApiService.setApprovalStep(username, agencyId, approval)
    } catch (error) {
      const message = approvalStepErrorMessage(error, name)
      if (!message) throw error
      req.flash('error', message)
      return res.redirect(backToList(req.body.q))
    }

    await auditService.logAuditEvent({
      what: AdminAction.SET_NOMIS_APPROVAL_STEP,
      who: username,
      subjectId: agencyId,
      subjectType: 'PRISON_ID',
      correlationId: req.id,
      details: { approval, ...change },
    })

    req.flash('success', approvalStepSuccessMessage(name, approval))
    return res.redirect(backToList(req.body.q))
  }
}

/** The error banner for an approval step change NOMIS is not ready for, or undefined for anything else. */
const approvalStepErrorMessage = (error: unknown, name: string): string | undefined => {
  if (error instanceof NomisScreenNotSetUpError) return screenNotSetUpMessage(error)
  if (error instanceof NomisSwitchNotSetUpError) {
    return `The NOMIS switches for ${error.missingSwitches.join(', ')} are not available in this environment yet.`
  }
  if (error instanceof NomisPrisonOnDpsError) {
    return `${name} is blocked in NOMIS because it uses CSRA in DPS, so the NOMIS approval step does not apply.`
  }
  return undefined
}
