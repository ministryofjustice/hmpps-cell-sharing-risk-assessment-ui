import { Forbidden } from 'http-errors'
import asyncMiddleware from './asyncMiddleware'

export default function permissionGuard(requiredPermission: string) {
  return asyncMiddleware((req, res, next) => {
    if (!res.locals.canAccess(requiredPermission)) {
      throw new Forbidden(`User does not have required permission: ${requiredPermission}`)
    }

    next()
  })
}
