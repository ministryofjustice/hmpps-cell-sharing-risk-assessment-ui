import type { Request, Response } from 'express'

import requireAdminRole, { canAdminister } from './requireAdminRole'
import { Role } from '../utils/roles'

describe('canAdminister', () => {
  it.each([
    [[Role.CSRA__ADMIN], true],
    [[Role.GLOBAL_SEARCH, Role.CSRA__ADMIN], true],
    [[Role.GLOBAL_SEARCH], false],
    [[], false],
    // The role is stored prefix-stripped, so the raw authority must not match.
    [['ROLE_CSRA__ADMIN'], false],
  ])('is %j -> %s', (roles, expected) => {
    expect(canAdminister(roles)).toBe(expected)
  })

  it('treats a missing roles array as not an admin', () => {
    expect(canAdminister(undefined)).toBe(false)
  })
})

describe('requireAdminRole', () => {
  const next = jest.fn()
  const res = (userRoles?: string[]) =>
    ({
      locals: userRoles ? { user: { userRoles } } : {},
      status: jest.fn().mockReturnThis(),
      render: jest.fn(),
    }) as unknown as Response

  beforeEach(() => jest.clearAllMocks())

  it('lets an admin through', () => {
    const response = res([Role.CSRA__ADMIN])

    requireAdminRole({} as Request, response, next)

    expect(next).toHaveBeenCalled()
    expect(response.render).not.toHaveBeenCalled()
  })

  it('renders the authorisation error page with a 403 for a non-admin', () => {
    const response = res([Role.GLOBAL_SEARCH])

    requireAdminRole({} as Request, response, next)

    expect(next).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(403)
    expect(response.render).toHaveBeenCalledWith('autherror')
  })

  it('denies when there is no signed-in user on res.locals', () => {
    const response = res()

    requireAdminRole({} as Request, response, next)

    expect(next).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(403)
  })
})
