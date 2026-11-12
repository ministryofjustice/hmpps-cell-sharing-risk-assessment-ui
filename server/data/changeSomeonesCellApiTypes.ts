/**
 * Types mirroring the hmpps-change-someones-cell-api response DTOs, hand-written to match the Kotlin models in
 * uk.gov.justice.digital.hmpps.changesomeonescellapi.dto. Date-times are ISO-8601 strings over the wire.
 */

/** Who a prisoner shared a cell with over a period (MAPA-477). */
export interface CellSharingHistory {
  /** The prisoner number */
  prisonerNumber: string
  /** Start of the period */
  from: string
  /** End of the period - now, if no end was given */
  to: string
  /** One entry per cell stay in the period where the prisoner shared, most recent first. Empty when they did not share. */
  cells: CellShare[]
}

/** A stay in a cell during which the prisoner shared with at least one other prisoner */
export interface CellShare {
  /** The prison the cell is in */
  prisonId: string
  /** The location key of the cell */
  locationKey: string
  /** The cell without the prison prefix, for display */
  pathHierarchy: string
  /** The DPS location id of the cell. Null if locations-inside-prison could not be reached or does not know the key. */
  dpsLocationId?: string | null
  /** The NOMIS location id of the cell. Only for linking to the prisoner profile location history page. */
  nomisLocationId: number
  /** When the prisoner moved into the cell. The whole stay, not cut to the period. */
  movedIn: string
  /** When the prisoner moved out of the cell. Null if they are still there. */
  movedOut?: string | null
  /** Everyone who shared the cell with the prisoner during the period, earliest first */
  sharedWith: Cellmate[]
}

/** A prisoner who shared a cell with the prisoner during the period */
export interface Cellmate {
  /** The cellmate's prisoner number */
  prisonerNumber: string
  /** The cellmate's first name. Null if prisoner-search has no record of them. */
  firstName?: string | null
  /** The cellmate's last name. Null if prisoner-search has no record of them. */
  lastName?: string | null
  /** When they started sharing, within the period */
  sharedFrom: string
  /** When they stopped sharing, within the period. Null if they are still sharing and no end to the period was given. */
  sharedTo?: string | null
}
