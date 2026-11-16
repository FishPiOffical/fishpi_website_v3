/** 与现网一致：未设置头像的用户显示 user-thumbnail.png */
export const DEFAULT_AVATAR = '/images/user-thumbnail.png'

type AvatarFields = {
  userAvatarURL?: string
  userAvatarURL20?: string
  userAvatarURL48?: string
  userAvatarURL210?: string
}

export function avatarUrl(u: AvatarFields | null | undefined, prefer: 'small' | 'large' = 'small'): string {
  if (!u) return DEFAULT_AVATAR
  const order =
    prefer === 'large'
      ? [u.userAvatarURL210, u.userAvatarURL, u.userAvatarURL48, u.userAvatarURL20]
      : [u.userAvatarURL48, u.userAvatarURL20, u.userAvatarURL, u.userAvatarURL210]
  return order.find((s) => typeof s === 'string' && s.trim()) || DEFAULT_AVATAR
}

function cssImage(url: string): string {
  // CSS string escaping preserves URL bytes instead of percent-encoding signed addresses.
  const value = url.replace(/[\u0000-\u001f\u007f"\\]/g, char => `\\${char.charCodeAt(0).toString(16)} `)
  return `url("${value}")`
}

export function avatarStyle(url: string | undefined | null, width?: number) {
  const original = url || DEFAULT_AVATAR
  const source = width === undefined ? original : avatarThumbnail(original, width)
  const fallback = source !== original ? `, ${cssImage(DEFAULT_AVATAR)}` : ''
  return { backgroundImage: cssImage(source) + fallback }
}

export function coverStyle(url: string, width: number) {
  return { backgroundImage: cssImage(imageThumbnail(url, width)) }
}

/** 只缩放 RhyPic 公开原图，保留带签名或已有处理参数的地址。 */
export function rhyPicThumbnail(url: string, width: number, height?: number): string {
  if (!Number.isInteger(width) || width < 1 || width > 1024) return url
  if (!/^https:\/\/file\.fishpi\.cn\/[^?#\s"<>\\]+\.(?:png|jpe?g|gif|webp|bmp|avif|heic|tiff?)$/i.test(url)) return url
  if (height !== undefined && Number.isInteger(height) && height > 0 && height <= 1024) {
    // RhyPic 的模式 1 同时限制宽高，模式 2 只限制宽度。
    return `${url}?imageView2/1/w/${width}/h/${height}`
  }
  return `${url}?imageView2/2/w/${width}`
}

/** 普通图片按 CSS 显示尺寸请求二倍图，最多 1024px。全屏预览可直接指定请求尺寸。 */
export function imageThumbnail(url: string, width: number, height?: number): string {
  if (!Number.isInteger(width) || width < 1 || width > 1024) return url
  const scaledHeight = height !== undefined && Number.isInteger(height) && height > 0
    ? Math.min(height * 2, 1024)
    : undefined
  return rhyPicThumbnail(url, Math.min(width * 2, 1024), scaledHeight)
}

export function avatarThumbnail(raw: string | undefined | null, width: number): string {
  return imageThumbnail(raw || DEFAULT_AVATAR, width)
}

/** 为已经过服务端清洗的 Markdown 图片补同一份 SSR/客户端缩图标记，保留 src 作为原图。 */
export function withImageThumbnailSrcset(html: string, width: number, height: number): string {
  return html.replace(/<!--[\s\S]*?-->|<(?:[^>"']|"[^"]*"|'[^']*')*>/g, tag => {
    if (!/^<img\s/i.test(tag)) return tag
    const attrs = new Map(Array.from(tag.matchAll(/\s+([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+)))?/g),
      ([, key, double, single, bare]) => [key!.toLowerCase(), double ?? single ?? bare ?? '']))
    if (attrs.has('srcset') || attrs.get('class')?.split(/\s+/).includes('emoji')) return tag
    const source = attrs.get('src')
    if (!source || source.includes('&')) return tag
    const thumbnail = imageThumbnail(source, width, height)
    return thumbnail === source ? tag : tag.replace(/^<img/i, name => `${name} srcset="${thumbnail}"`)
  })
}

export function imagePreviewSource(image: HTMLImageElement, width: number, height: number): string {
  const source = image.getAttribute('src') || ''
  const thumbnail = imageThumbnail(source, width, height)
  if (thumbnail !== source && thumbnail === image.getAttribute('srcset')) return image.src
  return image.currentSrc || image.src
}

export function fallbackAvatar(event: Event) {
  const img = event.currentTarget as HTMLImageElement
  if (img.getAttribute('src') !== DEFAULT_AVATAR) img.src = DEFAULT_AVATAR
}
