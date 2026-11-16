import { appendReferrers, referrerQuery, referrerStack, resolveOrigin } from './breadcrumbOrigins'

describe('referrerStack', () => {
  it('reads repeated params oldest first', () => {
    expect(referrerStack(['due-for-review', 'history'])).toEqual(['due-for-review', 'history'])
  })

  it('reads a single param', () => {
    expect(referrerStack('history')).toEqual(['history'])
  })

  it('drops anything that is not a known key', () => {
    // eslint-disable-next-line no-script-url -- the point of the case is that it is dropped
    expect(referrerStack(['https://evil.example', 'javascript:alert(1)', 'constructor', 'history'])).toEqual([
      'history',
    ])
  })

  it('returns an empty stack when there is no param', () => {
    expect(referrerStack(undefined)).toEqual([])
  })
})

describe('referrerQuery', () => {
  it('repeats the param for each entry', () => {
    expect(referrerQuery(['due-for-review', 'history'])).toBe('?referrer=due-for-review&referrer=history')
  })

  it('is empty for an empty stack', () => {
    expect(referrerQuery([])).toBe('')
  })

  it('is empty when there is no stack at all', () => {
    expect(referrerQuery(undefined)).toBe('')
  })

  it('round-trips through referrerStack', () => {
    const stack = ['all-prisoners', 'history'] as const
    const query = referrerQuery(stack).slice(1)
    expect(referrerStack(new URLSearchParams(query).getAll('referrer'))).toEqual(stack)
  })
})

describe('appendReferrers', () => {
  it('starts a query string when the URL has none', () => {
    expect(appendReferrers('/a/b', ['history'])).toBe('/a/b?referrer=history')
  })

  it('continues an existing query string with &', () => {
    expect(appendReferrers('/a/b?selectedRating=HIGH_GENERAL', ['due-for-review', 'history'])).toBe(
      '/a/b?selectedRating=HIGH_GENERAL&referrer=due-for-review&referrer=history',
    )
  })

  it('returns the URL unchanged for an empty stack', () => {
    expect(appendReferrers('/a/b?x=1')).toBe('/a/b?x=1')
    expect(appendReferrers('/a/b')).toBe('/a/b')
  })
})

describe('resolveOrigin', () => {
  it('resolves a known key and rejects anything else', () => {
    expect(resolveOrigin('due-for-review')).toBe('due-for-review')
    expect(resolveOrigin('history')).toBeUndefined()
    expect(resolveOrigin('toString')).toBeUndefined()
  })
})
