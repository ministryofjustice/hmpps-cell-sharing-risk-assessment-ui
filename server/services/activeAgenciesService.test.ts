import ActiveAgenciesService from './activeAgenciesService'
import type CsraApiClient from '../data/csraApiClient'

describe('ActiveAgenciesService', () => {
  const getActiveAgencyIds = jest.fn()
  const csraApiClient = { getActiveAgencyIds } as unknown as CsraApiClient
  let service: ActiveAgenciesService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ActiveAgenciesService(csraApiClient)
  })

  it('returns the active agency ids as a set', async () => {
    getActiveAgencyIds.mockResolvedValue(['MDI', 'LEI'])

    expect(await service.getActiveAgencyIds()).toEqual(new Set(['MDI', 'LEI']))
  })

  it('serves a second lookup from the cache rather than calling the API again', async () => {
    getActiveAgencyIds.mockResolvedValue(['MDI'])

    await service.getActiveAgencyIds()
    await service.getActiveAgencyIds()

    expect(getActiveAgencyIds).toHaveBeenCalledTimes(1)
  })

  it('refreshes from the API once the cache is invalidated', async () => {
    getActiveAgencyIds.mockResolvedValue(['MDI'])
    await service.getActiveAgencyIds()

    service.invalidate()
    getActiveAgencyIds.mockResolvedValue(['MDI', 'LEI'])

    expect(await service.getActiveAgencyIds()).toEqual(new Set(['MDI', 'LEI']))
    expect(getActiveAgencyIds).toHaveBeenCalledTimes(2)
  })

  it('serves the last known set when a refresh after the TTL fails, rather than throwing', async () => {
    jest.useFakeTimers()
    try {
      getActiveAgencyIds.mockResolvedValue(['MDI'])
      await service.getActiveAgencyIds()

      jest.advanceTimersByTime(6 * 60 * 1000)
      getActiveAgencyIds.mockRejectedValue(new Error('CSRA API down'))

      expect(await service.getActiveAgencyIds()).toEqual(new Set(['MDI']))
      expect(getActiveAgencyIds).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })

  it('degrades to an empty set when a refresh fails after an explicit invalidate', async () => {
    // invalidate() drops the cache outright, so unlike TTL expiry there is no last-known set to fall
    // back to — the safe default is "no prison switched on".
    getActiveAgencyIds.mockResolvedValue(['MDI'])
    await service.getActiveAgencyIds()
    service.invalidate()
    getActiveAgencyIds.mockRejectedValue(new Error('CSRA API down'))

    expect(await service.getActiveAgencyIds()).toEqual(new Set())
  })

  it('degrades to an empty set when the very first load fails', async () => {
    getActiveAgencyIds.mockRejectedValue(new Error('CSRA API down'))

    expect(await service.getActiveAgencyIds()).toEqual(new Set())
  })

  describe('isPrisonActive', () => {
    beforeEach(() => getActiveAgencyIds.mockResolvedValue(['MDI']))

    it('is true for a switched-on prison', async () => {
      expect(await service.isPrisonActive('MDI')).toBe(true)
    })

    it('is false for a prison still on NOMIS', async () => {
      expect(await service.isPrisonActive('LEI')).toBe(false)
    })

    it('is false for a missing prison id, without calling the API', async () => {
      expect(await service.isPrisonActive(undefined)).toBe(false)
      expect(getActiveAgencyIds).not.toHaveBeenCalled()
    })
  })

  describe('applyAgencyChange', () => {
    it('adds a prison that has just been switched on', async () => {
      getActiveAgencyIds.mockResolvedValue(['LEI'])

      await service.applyAgencyChange('MDI', true)

      expect(await service.getActiveAgencyIds()).toEqual(new Set(['LEI', 'MDI']))
    })

    it('removes a prison that has just been switched off', async () => {
      getActiveAgencyIds.mockResolvedValue(['LEI', 'MDI'])

      await service.applyAgencyChange('MDI', false)

      expect(await service.getActiveAgencyIds()).toEqual(new Set(['LEI']))
    })

    it('keeps the change even when the API still reports the old list', async () => {
      // The API caches /info briefly, so a read straight after a write can return the pre-change
      // list. Dropping the cache and refetching would latch that stale list for the whole TTL.
      getActiveAgencyIds.mockResolvedValue(['LEI'])
      await service.getActiveAgencyIds()

      await service.applyAgencyChange('MDI', true)

      expect(await service.isPrisonActive('MDI')).toBe(true)
    })

    it('still records a switch-off when the API has not caught up either', async () => {
      getActiveAgencyIds.mockResolvedValue(['LEI', 'MDI'])
      await service.getActiveAgencyIds()

      await service.applyAgencyChange('MDI', false)

      expect(await service.isPrisonActive('MDI')).toBe(false)
    })
  })
})
