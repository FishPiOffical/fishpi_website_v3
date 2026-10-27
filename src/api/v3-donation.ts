import { ApiError, request } from './http'
/** The server supplies its configured classic page; never construct a payment request. */
export function donationPageURL(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 4096 || /[\\\u0000-\u0020\u007f]/.test(value)) throw new ApiError('捐助页面地址不合法', 502)
  let url: URL
  try { url = new URL(value) } catch { throw new ApiError('捐助页面地址不合法', 502) }
  const local = import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (!(url.protocol === 'https:' || url.protocol === 'http:' && local) || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/charge/point') || /%|\/\/|(?:^|\/)\.\.?(?:\/|$)/.test(url.pathname) || /(?:^|\/)\.\.?(?:\/|$)/.test(value)) throw new ApiError('捐助页面地址不合法', 502)
  return url.href
}
export async function fetchV3DonationPage(): Promise<string> {
  const result = await request<{ code: number; data?: { url?: unknown }; msg?: string }>('/api/v3/payments/donation-page', { cache: 'no-store' })
  if (!result || result.code !== 0 || !result.data) throw new ApiError('无法读取捐助页面', 502)
  return donationPageURL(result.data.url)
}
