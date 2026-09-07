import type { Request, Response } from 'express'

import requireActivePrison from './requireActivePrison'
import type ActiveAgenciesService from '../services/activeAgenciesService'

describe('requireActivePrison', () => {
  const next = jest.fn()
  const isPrisonActive = jest.fn()
  const activeAgenciesService = { isPrisonActive } as unknown as ActiveAgenciesService
  const middleware = requireActivePrison(activeAgenciesService)

  const res = (caseLoadId?: string) =>
    ({
      locals: {
        feComponents: caseLoadId ? { sharedData: { activeCaseLoad: { caseLoadId } } } : undefined,
      },
      status: jest.fn().mockReturnThis(),
      render: jest.fn(),
    }) as unknown as Response

  beforeEach(() => jest.clearAllMocks())

  it('lets the request through when the establishment is switched on', async () => {
    isPrisonActive.mockResolvedValue(true)
    const response = res('MDI')

    await middleware({} as Request, response, next)

    expect(isPrisonActive).toHaveBeenCalledWith('MDI')
    expect(next).toHaveBeenCalled()
    expect(response.render).not.toHaveBeenCalled()
  })

  it('renders the authorisation error page with a 403 when the establishment is still on NOMIS', async () => {
    isPrisonActive.mockResolvedValue(false)
    const response = res('MDI')

    await middleware({} as Request, response, next)

    expect(next).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(403)
    expect(response.render).toHaveBeenCalledWith('autherror')
  })

  it('fails closed when there is no active caseload, without calling the service', async () => {
    const response = res()

    await middleware({} as Request, response, next)

    expect(isPrisonActive).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(403)
  })
})
