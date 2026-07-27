import CsraApiClient from '../data/csraApiClient'
import logger from '../../logger'

/**
 * How long the set of DPS-active prisons is trusted before it is refreshed from the API's `/info`
 * endpoint. The list changes only when an admin toggles a prison during rollout, so a few minutes
 * keeps the read path cheap while staying responsive. A toggle in the admin console also invalidates
 * this cache in-process, so the acting admin sees the change immediately; the TTL is what converges
 * the other pods.
 */
const ACTIVE_AGENCIES_TTL_MS = 5 * 60 * 1000

/**
 * Resolves which prisons have the CSRA service switched on in DPS, so the service is usable only at a
 * prison that has been rolled out (mutual exclusivity with NOMIS). The active set is national and not
 * user-specific, so a single process-wide cached Set with a short TTL is enough — no Redis needed.
 */
export default class ActiveAgenciesService {
  private cache: { ids: Set<string>; expiry: number } | null = null

  constructor(private readonly csraApiClient: CsraApiClient) {}

  /**
   * The set of agency ids switched on in DPS, served from the short-lived cache when fresh.
   *
   * Never throws: if the refresh fails it logs and returns the last-known set (or an empty set), so
   * viewing never breaks. A transient failure simply means the service stays gated, which is the safe
   * default during rollout.
   */
  async getActiveAgencyIds(): Promise<Set<string>> {
    const now = Date.now()
    if (this.cache && this.cache.expiry > now) {
      return this.cache.ids
    }

    try {
      const ids = new Set(await this.csraApiClient.getActiveAgencyIds())
      this.cache = { ids, expiry: now + ACTIVE_AGENCIES_TTL_MS }
      return ids
    } catch (error) {
      logger.warn(`Failed to load active agencies: ${(error as Error).message}`)
      return this.cache?.ids ?? new Set<string>()
    }
  }

  /** Whether the given prison currently has CSRA switched on in DPS. */
  async isPrisonActive(prisonId: string): Promise<boolean> {
    if (!prisonId) return false
    return (await this.getActiveAgencyIds()).has(prisonId)
  }

  /** Drop the cache so the next lookup refreshes from the API. Called after an admin toggle. */
  invalidate(): void {
    this.cache = null
  }
}
