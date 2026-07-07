import type { Request, Response } from 'express'
import type { HttpError } from 'http-errors'

import checkPrisonerAccess from './checkPrisonerAccess'
import PrisonerSearchService from '../services/prisonerSearchService'
import PrisonApiService from '../services/prisonApiService'
import type { Prisoner } from '../data/prisonerSearchApiTypes'
import type { CaseLoad } from '../data/prisonApiClient'

jest.mock('../services/prisonerSearchService')
jest.mock('../services/prisonApiService')

const prisonerSearchService = new PrisonerSearchService(null) as jest.Mocked<PrisonerSearchService>
const prisonApiService = new PrisonApiService(null) as jest.Mocked<PrisonApiService>

const leeds: CaseLoad = { caseLoadId: 'LEI', description: 'Leeds (HMP)', type: 'INST', currentlyActive: true }

const prisonerAt = (prisonId?: string): Prisoner => ({
  prisonerNumber: 'A1234BC',
  firstName: 'JOHN',
  lastName: 'SMITH',
  prisonId,
})

/**
 * Runs the middleware and resolves once next() has been called (asyncMiddleware calls next exactly
 * once on both the success and error paths), returning the error passed to next (if any).
 */
async function run(prisonerNumber: string, userRoles: string[]): Promise<HttpError | undefined> {
  const handler = checkPrisonerAccess(prisonerSearchService, prisonApiService)
  const req = { params: { prisonerNumber } } as unknown as Request<{ prisonerNumber: string }>
  const res = { locals: { user: { username: 'user1', token: 'token', userRoles } } } as unknown as Response

  return new Promise(resolve => {
    handler(req, res, ((err?: unknown) => resolve(err as HttpError | undefined)) as never)
  })
}

beforeEach(() => {
  jest.resetAllMocks()
  prisonApiService.getUserCaseLoads.mockResolvedValue([leeds])
})

describe('checkPrisonerAccess', () => {
  it('rejects an invalid prisoner number with a 404 before looking anything up', async () => {
    const err = await run('not-a-number', [])

    expect(err?.status).toBe(404)
    expect(prisonerSearchService.getPrisoner).not.toHaveBeenCalled()
    expect(prisonApiService.getUserCaseLoads).not.toHaveBeenCalled()
  })

  describe('prisoner currently in an establishment', () => {
    it('allows access when the prisoner is in one of the user’s caseloads', async () => {
      prisonerSearchService.getPrisoner.mockResolvedValue(prisonerAt('LEI'))

      const err = await run('A1234BC', [])

      expect(err).toBeUndefined()
    })

    it('denies access with a 404 when the prisoner is in a prison the user does not hold', async () => {
      prisonerSearchService.getPrisoner.mockResolvedValue(prisonerAt('MDI'))

      const err = await run('A1234BC', [])

      expect(err?.status).toBe(404)
    })

    it('allows a GLOBAL_SEARCH user without checking caseloads', async () => {
      prisonerSearchService.getPrisoner.mockResolvedValue(prisonerAt('MDI'))

      const err = await run('A1234BC', ['GLOBAL_SEARCH'])

      expect(err).toBeUndefined()
      expect(prisonApiService.getUserCaseLoads).not.toHaveBeenCalled()
    })

    it('stashes the looked-up prisoner on res.locals for handlers to reuse', async () => {
      const prisoner = prisonerAt('LEI')
      prisonerSearchService.getPrisoner.mockResolvedValue(prisoner)
      const handler = checkPrisonerAccess(prisonerSearchService, prisonApiService)
      const req = { params: { prisonerNumber: 'A1234BC' } } as unknown as Request<{ prisonerNumber: string }>
      const res = { locals: { user: { username: 'user1', token: 'token', userRoles: [] } } } as unknown as Response

      await new Promise<void>(resolve => {
        handler(req, res, () => resolve())
      })

      expect(res.locals.prisoner).toBe(prisoner)
    })
  })

  describe.each(['OUT', 'TRN', undefined])('prisoner no longer in an establishment (prisonId=%s)', prisonId => {
    it('denies a user without INACTIVE_BOOKINGS, even with GLOBAL_SEARCH', async () => {
      prisonerSearchService.getPrisoner.mockResolvedValue(prisonerAt(prisonId))

      const err = await run('A1234BC', ['GLOBAL_SEARCH'])

      expect(err?.status).toBe(404)
    })

    it('allows a user with INACTIVE_BOOKINGS', async () => {
      prisonerSearchService.getPrisoner.mockResolvedValue(prisonerAt(prisonId))

      const err = await run('A1234BC', ['INACTIVE_BOOKINGS'])

      expect(err).toBeUndefined()
    })
  })
})
