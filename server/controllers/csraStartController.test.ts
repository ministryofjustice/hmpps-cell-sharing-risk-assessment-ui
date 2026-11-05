import csraStartController from './csraStartController'

describe('csraStartController', () => {
  const csraService = {
    startCsraAssessment: jest.fn(),
  }

  const controller = () => csraStartController({ auditService: {} as never, csraService } as never)

  const request = () => ({ id: 'request-id-123', query: {} }) as any

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

  it('keeps known referrers on the redirect and drops any value that is not a known origin', async () => {
    const res = response()

    await controller()(
      { ...request(), query: { referrer: ['due-for-review', 'https://evil.example'] } },
      res,
      jest.fn(),
    )

    expect(res.redirect).toHaveBeenCalledWith('/prisoner/A1234BC/csra/assessment-123?referrer=due-for-review')
  })

  it('passes through when no active caseload is available', async () => {
    const res = response(null)

    await controller()(request(), res, jest.fn())

    expect(csraService.startCsraAssessment).toHaveBeenCalledWith('user1', 'A1234BC', undefined)
  })
})
