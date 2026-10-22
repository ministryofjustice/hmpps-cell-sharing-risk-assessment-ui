import type { Request, Response, NextFunction, RequestHandler } from 'express'
import ValidationFunction from '../lib/transactionFlow/validations/validationFunction'

export interface FormControllerOptions {
  validations?: Record<string, ValidationFunction[]>
  viewPath?: string
}

export default abstract class FormController<ParamType extends object> {
  protected validations: Record<string, ValidationFunction[]>

  protected viewPath?: string

  constructor(options: FormControllerOptions) {
    this.validations = options.validations || {}
    this.viewPath = options.viewPath
  }

  requestHandler(): RequestHandler<ParamType> {
    return async (req, res, next) => {
      if (!(await this.setupLocals(req, res))) {
        return
      }

      await this.request(req, res, next)
    }
  }

  /** Set up any locals required for the view. Return false to stop processing the request. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async setupLocals(req: Request<ParamType>, res: Response): Promise<boolean> {
    return true
  }

  protected async request(req: Request<ParamType>, res: Response, next: NextFunction) {
    if (req.method === 'GET') {
      await this.get(req, res, next)
    } else if (req.method === 'POST') {
      await this.post(req, res, next)
    }
  }

  protected async get(req: Request<ParamType>, res: Response, next: NextFunction) {
    await this.render(req, res)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getValidations(req: Request<ParamType>, res: Response) {
    return this.validations
  }

  protected abstract getNextLink(req: Request<ParamType>, res: Response): string

  protected validate(req: Request<ParamType>, res: Response) {
    const validationErrors: Record<string, { text: string } | { html: string }> = {}
    const values: Record<string, string | string[] | number | undefined> = {}
    const strippedValueEntries = Object.entries(req.body)
      .filter(([key]) => !key.startsWith('_'))
      .filter(
        ([, value]) =>
          typeof value === 'string' ||
          typeof value === 'number' ||
          (typeof value === 'object' && Array.isArray(value)) ||
          typeof value === 'undefined',
      ) as [string, string | string[] | number | undefined][]
    for (const [key, value] of strippedValueEntries) {
      values[key] = value

      if (typeof value === 'string') {
        values[key] = value.trim()
      }
    }

    for (const [key, validators] of Object.entries(this.getValidations(req, res))) {
      const value = values[key]
      for (const validator of validators) {
        const error = validator(value)

        if (error) {
          validationErrors[key] = { text: error }
          break
        }
      }
    }

    res.locals.values = values
    res.locals.validationErrors = validationErrors

    return !Object.keys(validationErrors).length
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async sendPost(req: Request<ParamType>, res: Response): Promise<void> {
    // Default implementation does nothing. Subclasses can override to send data to a service.
  }

  protected async post(req: Request<ParamType>, res: Response, next: NextFunction) {
    if (!this.validate(req, res)) {
      await this.render(req, res)
      return
    }

    await this.sendPost(req, res)

    res.redirect(this.getNextLink(req, res))
  }

  protected async render(req: Request<ParamType>, res: Response) {
    res.render(this.viewPath, {
      ...req.params,
      ...res.locals,
    })
  }
}
