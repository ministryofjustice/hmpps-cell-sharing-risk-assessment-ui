import { RequestHandler } from 'express';

const setHasRole: RequestHandler = (_req, res, next) => {
  res.locals.hasRole = (role: string) => {
    return res.locals.user?.userRoles?.includes(role) ?? false
  }
  next()
}

export default setHasRole
