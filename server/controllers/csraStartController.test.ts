import csraStartController from './csraStartController'

describe('csraStartController', () => {
  const csraService = {
    startCsraAssessment: jest.fn(),
  }

  const controller = () => csraStartController({ auditService: {} as never, csraService } as never)

  const request = () => ({ id: 'request-id-123' }) as any

  const response = (activeCaseLoad = { caseLoadId: 'MDI' }) =>
    ({
      locals: {
        user: { username: 'user1' },
        prisoner: { prisonerNumber: 'A1234BC' },
        feComponents: activeCaseLoad ? { sharedData: { activeCaseLoad } } : undefined,
      },
      redirect: jest.fn(),
    }) as any

  beforeEach(() => {
    jest.clearAllMocks()
    csraService.startCsraAssessment.mockResolvedValue({ assessmentId: 'assessment-123' })
  })

  it('starts a CSRA assessment and redirects to the new assessment page', async () => {
    const res = response()

    await controller()(request(), res, jest.fn())

    expect(csraService.startCsraAssessment).toHaveBeenCalledWith('user1', 'A1234BC', 'MDI')
    expect(res.redirect).toHaveBeenCalledWith('/prisoner/A1234BC/csra/assessment-123')
  })

  it('passes through when no active caseload is available', async () => {
    const res = response(null)

    await controller()(request(), res, jest.fn())

    expect(csraService.startCsraAssessment).toHaveBeenCalledWith('user1', 'A1234BC', undefined)
  })
})
