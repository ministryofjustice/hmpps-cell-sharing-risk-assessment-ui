import type ManageUsersService from '../services/manageUsersService'

/**
 * Populates `locals.userDisplayNames` with a username -> display-name map.
 *
 * - De-duplicates usernames to avoid repeat API calls.
 * - Ignores failed lookups so callers can fall back to the raw username.
 */
export async function populateUserDisplayNames(
  locals: { [key: string]: unknown; userDisplayNames?: Map<string, string> },
  manageUsersService: Pick<ManageUsersService, 'getUserDetails'>,
  actingUsername: string,
  usernames: string[],
): Promise<void> {
  const uniqueUsernames = Array.from(new Set(usernames))

  const lookups = await Promise.allSettled(
    uniqueUsernames.map(async username => {
      const userDetails = await manageUsersService.getUserDetails(actingUsername, username)
      return [username, userDetails.name] as const
    }),
  )

  /*  eslint-disable no-param-reassign */
  locals.userDisplayNames = new Map(
    lookups
      .filter((lookup): lookup is PromiseFulfilledResult<readonly [string, string]> => lookup.status === 'fulfilled')
      .map(lookup => lookup.value),
  )
}

/**
 * Resolve a username to a display name using the map attached to the render context.
 */
export function userDisplayName(this: { ctx?: { userDisplayNames?: Map<string, string> } }, username: string): string {
  const map = this?.ctx?.userDisplayNames
  return map?.get(username) ?? username
}
