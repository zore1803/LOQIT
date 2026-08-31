/**
 * Compatibility shim.
 *
 * Supabase has been removed — auth is now issued by the LOQIT API and data
 * lives in MongoDB. This module keeps the old import path and the
 * `supabase.auth.*` surface so existing screens keep working unchanged.
 *
 * New code should import from `./authClient` (auth) or `./db` (data) directly.
 */
import { auth } from './authClient'

export const supabase = { auth }

export { auth }
export type { AuthSession, AuthUser } from './authClient'
