import QRCode from 'qrcode'
import { appLoginHandle } from '@/api/v3-app-login'

/** Generate only a local matrix; never send the scan capability to an image service. */
export function appLoginQr(payload: string) {
  if (!payload.startsWith('fishpi-login:v3:')) throw new Error('扫码文本不合法')
  appLoginHandle(payload.slice('fishpi-login:v3:'.length))
  const { modules } = QRCode.create(payload, { errorCorrectionLevel: 'M' })
  const margin = 4, size = modules.size + margin * 2
  let path = ''
  for (let y = 0; y < modules.size; y++) for (let x = 0; x < modules.size; x++) {
    if (modules.get(y, x)) path += `M${x + margin},${y + margin}h1v1h-1z`
  }
  return { size, path }
}
