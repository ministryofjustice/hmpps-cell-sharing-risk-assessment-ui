import type { NextFunction, Request, Response } from 'express'
import csraBreadcrumbs, { type CsraPage } from './csraBreadcrumbs'
import type { Breadcrumb } from './addBreadcrumb'

const prisoner = { prisonerNumber: 'A1234BC', firstName: 'DANIEL', lastName: 'HAVERS' }

type PrisonerRequest = Request<{ prisonerNumber: string }>

const run = (page: CsraPage, query: Request['query'] = {}) => {
  const req = { params: { prisonerNumber: 'A1234BC' }, query } as unknown as PrisonerRequest
  const res = { locals: { prisoner } } as unknown as Response
  const next = jest.fn() as NextFunction

  csraBreadcrumbs(page)(req, res, next)

  return { res, next, crumbs: res.locals.breadcrumbs as Breadcrumb[] }
}

describe('csraBreadcrumbs', () => {
  it('builds the plain chain when there is no origin', () => {
    const { crumbs } = run('current')

    expect(crumbs).toEqual([{ title: 'CSRA', href: '/' }, { title: 'Daniel Havers' }])
  })

  it('inserts the worklist the prisoner was reached from', () => {
    const { crumbs } = run('current', { from: 'due-for-review' })

    expect(crumbs).toEqual([
      { title: 'CSRA', href: '/' },
      { title: 'High risk prisoners due for review', href: '/due-for-review' },
      { title: 'Daniel Havers' },
    ])
  })

  it('links the prisoner crumb back to the current rating on the history page, keeping the origin', () => {
    const { crumbs } = run('history', { from: 'due-for-review' })

    expect(crumbs).toEqual([
      { title: 'CSRA', href: '/' },
      { title: 'High risk prisoners due for review', href: '/due-for-review' },
      { title: 'Daniel Havers', href: '/prisoner/A1234BC?from=due-for-review' },
      { title: 'CSRA history' },
    ])
  })

  it('adds a linked history crumb on the review page', () => {
    const { crumbs } = run('review', { from: 'due-for-review' })

    expect(crumbs).toEqual([
      { title: 'CSRA', href: '/' },
      { title: 'High risk prisoners due for review', href: '/due-for-review' },
      { title: 'Daniel Havers', href: '/prisoner/A1234BC?from=due-for-review' },
      { title: 'CSRA history', href: '/prisoner/A1234BC/history?from=due-for-review' },
      { title: 'CSRA review' },
    ])
  })

  it('gives the page you are on no href, so it renders as text rather than a link', () => {
    expect(run('current').crumbs.at(-1)).not.toHaveProperty('href')
    expect(run('history').crumbs.at(-1)).not.toHaveProperty('href')
    expect(run('review').crumbs.at(-1)).not.toHaveProperty('href')
  })

  it('appends to a trail already started earlier in the request', () => {
    const req = { params: { prisonerNumber: 'A1234BC' }, query: {} } as unknown as PrisonerRequest
    const res = {
      locals: { prisoner, breadcrumbs: [{ title: 'Digital Prison Services', href: 'http://dps' }] },
    } as unknown as Response

    csraBreadcrumbs('current')(req, res, jest.fn())

    expect((res.locals.breadcrumbs as Breadcrumb[])[0]).toEqual({
      title: 'Digital Prison Services',
      href: 'http://dps',
    })
  })

  it('exposes the origin for the page to keep on its own links', () => {
    expect(run('history', { from: 'due-for-review' }).res.locals).toMatchObject({
      fromKey: 'due-for-review',
      fromQuery: '?from=due-for-review',
    })
    expect(run('history').res.locals).toMatchObject({ fromKey: undefined, fromQuery: '' })
  })

  it.each([
    ['an unknown screen', 'not-a-screen'],
    ['an absolute URL', 'https://evil.example/phish'],
    // eslint-disable-next-line no-script-url -- the point of the case is that we never render it
    ['a javascript URL', 'javascript:alert(1)'],
    ['an inherited object property', 'constructor'],
    ['a prototype property', 'toString'],
    ['a path traversal', '../../admin/prisons'],
    ['an empty value', ''],
  ])('ignores %s entirely rather than rendering it', (_description, from) => {
    const { crumbs, res } = run('current', { from })

    expect(crumbs).toEqual([{ title: 'CSRA', href: '/' }, { title: 'Daniel Havers' }])
    expect(res.locals.fromQuery).toBe('')
    expect(JSON.stringify(crumbs)).not.toContain(from || 'nothing-to-find')
  })

  it('takes the first value when the param is repeated, and still whitelists it', () => {
    expect(run('current', { from: ['due-for-review', 'https://evil.example'] }).res.locals.fromKey).toBe(
      'due-for-review',
    )
    expect(run('current', { from: ['https://evil.example', 'due-for-review'] }).res.locals.fromKey).toBeUndefined()
  })

  it('always calls next', () => {
    expect(run('current').next).toHaveBeenCalled()
  })
})
