import ChangeSomeonesCellApiClient from '../data/changeSomeonesCellApiClient'
import { CellSharingHistory } from '../data/changeSomeonesCellApiTypes'

export default class ChangeSomeonesCellService {
  constructor(private readonly changeSomeonesCellApiClient: ChangeSomeonesCellApiClient) {}

  getCellSharingHistory(
    actingUsername: string,
    params: { prisonerNumber: string; from: string; to?: string },
  ): Promise<CellSharingHistory> {
    return this.changeSomeonesCellApiClient.getCellSharingHistory(actingUsername, params)
  }
}
