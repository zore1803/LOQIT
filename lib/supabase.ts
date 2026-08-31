/**
 * Compatibility shim.
 *
 * Supabase has been removed — auth is issued by the LOQIT API and data lives in
 * MongoDB. This keeps the old import path and the `supabase.auth.*` surface so
 * existing screens and background tasks work unchanged.
 *
 * New code should import from `./authClient` (auth) or `./db` (data).
 */
import { auth } from './authClient'

export const supabase = { auth }

export { auth }
export type { AuthSession, AuthUser } from './authClient'
