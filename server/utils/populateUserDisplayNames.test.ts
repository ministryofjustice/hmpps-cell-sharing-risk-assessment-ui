import { populateUserDisplayNames, userDisplayName } from './populateUserDisplayNames'

describe('populateUserDisplayNames', () => {
  it('de-duplicates usernames and stores a map of names on locals', async () => {
    const locals: { userDisplayNames?: Map<string, string> } = {}
    const manageUsersService = {
      getUserDetails: jest.fn().mockImplementation(async (_: string, username: string) => {
        if (username === 'JBLOGGS') return { name: 'Joe Bloggs' }
        if (username === 'MSTANLEY') return { name: 'Mia Stanley' }
        return { name: username }
      }),
    }

    await populateUserDisplayNames(locals, manageUsersService as any, 'AUSER_GEN', ['JBLOGGS', 'MSTANLEY', 'JBLOGGS'])

    expect(manageUsersService.getUserDetails).toHaveBeenCalledTimes(2)
    expect(manageUsersService.getUserDetails).toHaveBeenCalledWith('AUSER_GEN', 'JBLOGGS')
    expect(manageUsersService.getUserDetails).toHaveBeenCalledWith('AUSER_GEN', 'MSTANLEY')
    expect(locals.userDisplayNames?.get('JBLOGGS')).toBe('Joe Bloggs')
    expect(locals.userDisplayNames?.get('MSTANLEY')).toBe('Mia Stanley')
  })

  it('ignores failed lookups so callers can fall back to username', async () => {
    const locals: { userDisplayNames?: Map<string, string> } = {}
    const manageUsersService = {
      getUserDetails: jest.fn().mockImplementation(async (_: string, username: string) => {
        if (username === 'MSTANLEY') throw new Error('Lookup failed')
        return { name: 'Joe Bloggs' }
      }),
    }

    await populateUserDisplayNames(locals, manageUsersService as any, 'AUSER_GEN', ['JBLOGGS', 'MSTANLEY'])

    expect(locals.userDisplayNames?.get('JBLOGGS')).toBe('Joe Bloggs')
    expect(locals.userDisplayNames?.has('MSTANLEY')).toBe(false)
  })
})

describe('userDisplayName', () => {
  it('returns the display name for a username if present in the map', () => {
    const ctx = { userDisplayNames: new Map([['JBLOGGS', 'Joe Bloggs']]) }
    const result = userDisplayName.call({ ctx }, 'JBLOGGS')
    expect(result).toBe('Joe Bloggs')
  })

  it('returns the username if not present in the map', () => {
    const ctx = { userDisplayNames: new Map([['JBLOGGS', 'Joe Bloggs']]) }
    const result = userDisplayName.call({ ctx }, 'MSTANLEY')
    expect(result).toBe('MSTANLEY')
  })

  it('returns the username if the map is undefined', () => {
    const result = userDisplayName.call({}, 'JBLOGGS')
    expect(result).toBe('JBLOGGS')
  })
})
