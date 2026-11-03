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

export function avatarStyle(url: string | undefined | null) {
  // CSS string escaping preserves URL bytes instead of percent-encoding signed addresses.
  const value = (url || DEFAULT_AVATAR).replace(/[\u0000-\u001f\u007f"\\]/g, char => `\\${char.charCodeAt(0).toString(16)} `)
  return { backgroundImage: `url("${value}")` }
}
