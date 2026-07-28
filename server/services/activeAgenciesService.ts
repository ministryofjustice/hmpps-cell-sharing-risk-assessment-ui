import CsraApiClient from '../data/csraApiClient'
import config from '../config'
import logger from '../../logger'

/**
 * Resolves which prisons have the CSRA service switched on in DPS, so the service is usable only at a
 * prison that has been rolled out (mutual exclusivity with NOMIS). The active set is national and not
 * user-specific, so a single process-wide cached Set with a short TTL is enough — no Redis needed.
 */
export default class ActiveAgenciesService {
  private cache: { ids: Set<string>; expiry: number } | null = null

  /**
   * [ttlMs] is how long a fetched set is trusted; zero disables caching (see config.activeAgencies).
   * A toggle in the admin console updates this cache in-process so the acting admin sees the change
   * immediately; the TTL is what converges the other pods.
   */
  constructor(
    private readonly csraApiClient: CsraApiClient,
    private readonly ttlMs: number = config.activeAgencies.ttlMs,
  ) {}

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
      this.cache = { ids, expiry: now + this.ttlMs }
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

  /**
   * Records a change an admin has just made, so this pod reflects it immediately.
   *
   * Deliberately applies the known change rather than dropping the cache and refetching: the API
   * caches `/info` for a couple of seconds, so a refetch triggered straight after a write reads back
   * the *pre-change* list and then caches that for the full TTL. Switching a prison off is the
   * dangerous direction there — it would stay writable in DPS after the admin had turned it off.
   *
   * Any other prison in the refreshed set could still be up to the API's `/info` cache window out of
   * date, which only matters if two admins toggle different prisons in the same couple of seconds,
   * and corrects itself on the next refresh.
   */
  async applyAgencyChange(agencyId: string, active: boolean): Promise<void> {
    const ids = new Set(await this.getActiveAgencyIds())
    if (active) {
      ids.add(agencyId)
    } else {
      ids.delete(agencyId)
    }
    this.cache = { ids, expiry: Date.now() + this.ttlMs }
  }

  /** Drop the cache so the next lookup refreshes from the API. */
  invalidate(): void {
    this.cache = null
  }
}
