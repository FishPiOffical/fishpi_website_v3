/**
 * Rhythm 防漏扫验证码链路（见 rhythm AGENTS.md）：
 * BeforeRequestHandler / AnonymousViewCheckMidware → V3 403 captcha_required
 * 旧页面仍跳转 /test；V3 与旧页面共用同 IP 的持续待验证状态。
 * CaptchaProcessor#validateCaptcha（极验）→ 解封
 *
 * SPA 侧由 RiskCaptchaGate 注册 opener，request() 遇 captcha 时 await 解封后重试一次。
 */

type Opener = () => Promise<void>

let opener: Opener | null = null
let inflight: Promise<void> | null = null

export function registerRiskCaptchaOpener(fn: Opener | null) {
  opener = fn
}

/** 弹出全局极验并等待 /validateCaptcha 成功；并发调用共用同一次验证。 */
export function ensureRiskCaptcha(): Promise<void> {
  if (import.meta.env.SSR) {
    return Promise.reject(new Error('服务端无法完成人机验证'))
  }
  if (inflight) return inflight
  if (!opener) {
    return Promise.reject(new Error('访问过于频繁，请完成人机验证后再试'))
  }
  const open = opener
  inflight = Promise.resolve().then(open).finally(() => {
    inflight = null
  })
  return inflight
}
