import { Forbidden } from 'http-errors'

import permissionGuard from './permissionGuard'

describe('permissionGuard', () => {
  const next = jest.fn()

  const res = (allowed = true) =>
    ({
      locals: {
        canAccess: jest.fn().mockReturnValue(allowed),
      },
      status: jest.fn().mockReturnThis(),
      render: jest.fn(),
    }) as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lets a user through when they have the required permission', () => {
    const response = res(true)
    permissionGuard('edit_assessment')({} as any, response, next)

    expect(next).toHaveBeenCalled()
    expect(response.locals.canAccess).toHaveBeenCalledWith('edit_assessment')
  })

  it('throws a Forbidden error when the user does not have the required permission', () => {
    const response = res(false)

    expect(() => permissionGuard('edit_assessment')({} as any, response, next)).toThrow(Forbidden)
    expect(response.locals.canAccess).toHaveBeenCalledWith('edit_assessment')
  })
})
