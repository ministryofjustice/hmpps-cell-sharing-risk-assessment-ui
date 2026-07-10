export interface Caseload {
  id: string
  name: string
}

export interface UserCaseloads {
  username: string
  active: boolean
  accountType: string
  activeCaseload?: Caseload
  caseloads: Caseload[]
}
