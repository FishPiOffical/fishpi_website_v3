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

export function avatarStyle(url: string | undefined | null, width?: number) {
  // CSS string escaping preserves URL bytes instead of percent-encoding signed addresses.
  const original = url || DEFAULT_AVATAR
  const source = width === undefined ? original : avatarThumbnail(original, width)
  const value = source.replace(/[\u0000-\u001f\u007f"\\]/g, char => `\\${char.charCodeAt(0).toString(16)} `)
  const fallback = source !== original ? `, url("${DEFAULT_AVATAR}")` : ''
  return { backgroundImage: `url("${value}")${fallback}` }
}

/** 只缩放 RhyPic 公开原图；现网 GIF 缩图可能只返回首帧，保留原地址。 */
export function avatarThumbnail(raw: string | undefined | null, width: number): string {
  const value = raw || DEFAULT_AVATAR
  if (!Number.isInteger(width) || width < 1 || width > 256) return value
  if (!/^https:\/\/file\.fishpi\.cn\/[^?#\s"<>\\]+\.(?:png|jpe?g|webp|bmp|avif|heic|tiff?)$/i.test(value)) return value
  return `${value}?imageView2/2/w/${width}`
}

export function fallbackAvatar(event: Event) {
  const img = event.currentTarget as HTMLImageElement
  if (img.getAttribute('src') !== DEFAULT_AVATAR) img.src = DEFAULT_AVATAR
}
