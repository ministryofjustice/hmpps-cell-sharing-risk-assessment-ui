import { Forbidden } from 'http-errors'

import roleGuard from './roleGuard'
import { Role } from '../utils/roles'

describe('roleGuard', () => {
  const next = jest.fn()

  const res = (allowed = true) =>
    ({
      locals: {
        hasRole: jest.fn().mockReturnValue(allowed),
      },
      status: jest.fn().mockReturnThis(),
      render: jest.fn(),
    }) as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lets a user through when they hold the required role', () => {
    const response = res(true)
    roleGuard(Role.CSRA__ASSESSMENT_EDIT)({} as any, response, next)

    expect(next).toHaveBeenCalled()
    expect(response.locals.hasRole).toHaveBeenCalledWith(Role.CSRA__ASSESSMENT_EDIT)
  })

  it('throws a Forbidden error when the user does not hold the required role', () => {
    const response = res(false)

    expect(() => roleGuard(Role.CSRA__ASSESSMENT_EDIT)({} as any, response, next)).toThrow(Forbidden)
    expect(response.locals.hasRole).toHaveBeenCalledWith(Role.CSRA__ASSESSMENT_EDIT)
  })

  it('throws a Forbidden error when there is no signed-in user', () => {
    const response = res(false)
    response.locals.user = undefined

    expect(() => roleGuard(Role.CSRA__ASSESSMENT_EDIT)({} as any, response, next)).toThrow(Forbidden)
  })
})
