/**
 * Types mirroring the prison-api splash-screen models, hand-written to match the API. A splash screen
 * gates a NOMIS screen/module; its per-caseload conditions are what this service manages.
 */

/**
 * A caseload (or other) condition on a NOMIS splash screen. `blockAccess: false` shows the warning
 * text and lets the user proceed; `blockAccess: true` blocks access and shows the blocked text.
 */
export interface SplashScreenCondition {
  conditionType: string
  conditionValue: string
  blockAccess: boolean
}

/**
 * A NOMIS splash screen for a screen/module. The warning and blocked text, and `blockAccessType`
 * (YES/NO/COND), are configured manually in NOMIS; this service only reads them and edits the
 * per-caseload conditions.
 */
export interface SplashScreen {
  moduleName: string
  warningText?: string
  blockedText?: string
  blockAccessType?: string
  conditions: SplashScreenCondition[]
}
