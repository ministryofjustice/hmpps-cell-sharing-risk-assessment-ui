import type { Request, Response } from 'express'
import FormController, { FormControllerOptions } from './formController'
import required from '../lib/transactionFlow/validations/required'

class TestFormController extends FormController<Record<string, string>> {
  proceed = true

  override sendPost = jest.fn().mockResolvedValue(undefined)

  constructor(validations: FormControllerOptions['validations'] = { comment: [required('Enter a comment')] }) {
    super({
      viewPath: 'pages/testForm',
      validations,
    })
  }

  protected override async setupLocals(): Promise<boolean> {
    return this.proceed
  }

  protected getNextLink(): string {
    return '/next'
  }
}

describe('FormController', () => {
  const setup = (
    method = 'POST',
    body: Record<string, unknown> = {},
    validations?: FormControllerOptions['validations'],
  ) => {
    const controller = new TestFormController(validations)
    const req = {
      method,
      params: { assessmentId: 'assessment-123' },
      body,
    } as unknown as Request<Record<string, string>>
    const res = {
      locals: { backLink: '/back' },
      render: jest.fn(),
      redirect: jest.fn(),
    } as unknown as Response
    const handle = () => controller.requestHandler()(req, res, jest.fn())
    return { controller, req, res, handle }
  }

  it('renders GET requests with parameters and locals without submitting', async () => {
    const { controller, res, handle } = setup('GET')

    await handle()

    expect(res.render).toHaveBeenCalledWith('pages/testForm', {
      assessmentId: 'assessment-123',
      backLink: '/back',
    })
    expect(controller.sendPost).not.toHaveBeenCalled()
  })

  it('stops processing when setupLocals redirects or otherwise declines the request', async () => {
    const { controller, res, handle } = setup()
    controller.proceed = false

    await handle()

    expect(res.render).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
    expect(controller.sendPost).not.toHaveBeenCalled()
  })

  it('renders errors for whitespace-only required values and retains normalized form values', async () => {
    const { controller, req, res, handle } = setup('POST', {
      comment: '  ',
      date: ' 17/5/2099 ',
      count: 0,
      sources: ['PNC'],
      optional: undefined,
      _csrf: 'token',
      nested: { value: 'discard' },
      empty: null,
      flag: true,
    })

    await handle()

    expect(res.locals.values).toEqual({
      comment: '',
      date: '17/5/2099',
      count: 0,
      sources: ['PNC'],
      optional: undefined,
    })
    expect(res.locals.validationErrors).toEqual({ comment: { text: 'Enter a comment' } })
    expect(req.body.comment).toBe('  ')
    expect(res.render).toHaveBeenCalled()
    expect(controller.sendPost).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('submits valid values before redirecting to the next step', async () => {
    const { controller, req, res, handle } = setup('POST', { comment: 'Complete' })
    controller.sendPost.mockImplementation(async () => {
      expect(res.redirect).not.toHaveBeenCalled()
    })

    await handle()

    expect(res.locals.validationErrors).toEqual({})
    expect(controller.sendPost).toHaveBeenCalledWith(req, res)
    expect(res.redirect).toHaveBeenCalledWith('/next')
    expect(res.render).not.toHaveBeenCalled()
  })

  it('records only the first error per field while validating all fields', async () => {
    const laterValidator = jest.fn().mockReturnValue('Later error')
    const { res, handle } = setup(
      'POST',
      {},
      {
        comment: [required('Enter a comment'), laterValidator],
        date: [required('Enter a date')],
      },
    )

    await handle()

    expect(res.locals.validationErrors).toEqual({
      comment: { text: 'Enter a comment' },
      date: { text: 'Enter a date' },
    })
    expect(laterValidator).not.toHaveBeenCalled()
  })

  it('propagates submission failures without redirecting', async () => {
    const { controller, res, handle } = setup('POST', { comment: 'Complete' })
    const error = new Error('Submission failed')
    controller.sendPost.mockRejectedValue(error)

    await expect(handle()).rejects.toThrow(error)

    expect(res.redirect).not.toHaveBeenCalled()
  })
})
