import { Forbidden } from 'http-errors'
import asyncMiddleware from './asyncMiddleware'

export default function roleGuard(requiredRole: string) {
  return asyncMiddleware((req, res, next) => {
    if (!res.locals.hasRole(requiredRole)) {
      throw new Forbidden(`User does not have required role: ${requiredRole}`)
    }

    next()
  })
}
