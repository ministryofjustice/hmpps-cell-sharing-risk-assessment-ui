import type { Request, Response } from 'express'

import ActiveAgenciesService from '../services/activeAgenciesService'
import { Role } from '../utils/roles'
import setCanAccess from './setCanAccess'

describe('setCanAccess', () => {
  let req: Request
  let res: Response & {
    locals: {
      hasRole: jest.Mock
      canAccess?: (role: string) => boolean
      feComponents?: {
        sharedData?: {
          activeCaseLoad?: {
            caseLoadId?: string
          }
        }
      }
    }
  }
  const next = jest.fn()

  beforeEach(() => {
    req = {} as Request
    res = {
      locals: {
        hasRole: jest.fn(),
      },
    } as unknown as Response & {
      locals: {
        hasRole: jest.Mock
        canAccess?: (role: string) => boolean
        feComponents?: {
          sharedData?: {
            activeCaseLoad?: {
              caseLoadId?: string
            }
          }
        }
      }
    }
    next.mockReset()
  })

  async function runMiddleware(activeCaseLoadId: string | undefined, isPrisonActive: boolean) {
    const activeAgenciesService = {
      isPrisonActive: jest.fn().mockResolvedValue(isPrisonActive),
    } as unknown as ActiveAgenciesService

    res.locals.feComponents = activeCaseLoadId
      ? {
          sharedData: {
            activeCaseLoad: {
              caseLoadId: activeCaseLoadId,
            },
          },
        }
      : undefined

    setCanAccess(activeAgenciesService)(req, res, next)
    await new Promise<void>(resolve => {
      process.nextTick(resolve)
    })

    return { activeAgenciesService }
  }

  it('should allow assessment editing when the prison is active and the user has the assessment role', async () => {
    res.locals.hasRole.mockImplementation((role: string) => role === Role.CSRA__ASSESSMENT_EDIT)

    const { activeAgenciesService } = await runMiddleware('MDI', true)

    expect(activeAgenciesService.isPrisonActive).toHaveBeenCalledWith('MDI')
    expect(res.locals.canAccess?.('edit_assessment')).toBe(true)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('should deny assessment editing when the prison is inactive', async () => {
    res.locals.hasRole.mockImplementation((role: string) => role === Role.CSRA__ASSESSMENT_EDIT)

    await runMiddleware('MDI', false)

    expect(res.locals.canAccess?.('edit_assessment')).toBe(false)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('should deny assessment editing when the prison is active but the user does not have the assessment role', async () => {
    res.locals.hasRole.mockReturnValue(false)

    await runMiddleware('MDI', true)

    expect(res.locals.canAccess?.('edit_assessment')).toBe(false)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('should allow review editing when the prison is active and the user has the review role', async () => {
    res.locals.hasRole.mockImplementation((role: string) => role === Role.CSRA__REVIEW_EDIT)

    await runMiddleware('MDI', true)

    expect(res.locals.canAccess?.('edit_review')).toBe(true)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('should allow unspecified actions by default', async () => {
    res.locals.hasRole.mockReturnValue(false)

    await runMiddleware('MDI', false)

    expect(res.locals.canAccess?.('unknown_action')).toBe(true)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('should deny edit actions when no active caseload is present', async () => {
    res.locals.hasRole.mockImplementation((role: string) => role === Role.CSRA__ASSESSMENT_EDIT)

    const { activeAgenciesService } = await runMiddleware(undefined, false)

    expect(activeAgenciesService.isPrisonActive).toHaveBeenCalledWith(undefined)
    expect(res.locals.canAccess?.('edit_assessment')).toBe(false)
    expect(next).toHaveBeenCalledTimes(1)
  })
})
