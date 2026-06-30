const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')
const isLocalOrigin = (value: string) => /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(value)

export function getAuthRedirectUrl(path: string) {
  const configuredBase = import.meta.env.VITE_PUBLIC_SITE_URL || import.meta.env.VITE_SITE_URL || ''
  const currentOrigin = window.location.origin
  const shouldUseCurrentOrigin = !configuredBase || (isLocalOrigin(configuredBase) && !isLocalOrigin(currentOrigin))
  const base = trimTrailingSlash(shouldUseCurrentOrigin ? currentOrigin : configuredBase)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${base}${normalizedPath}`
}
