<script setup lang="ts">
import { usePageSeo } from '@/composables/usePageSeo'

usePageSeo(() => ({
  title: '客户端下载',
  path: '/download',
  description: '下载摸鱼派各端客户端，随时随地摸鱼。',
}))

interface ClientLink {
  label: string
  href: string
}

interface ClientApp {
  id: string
  name: string
  icon: string
  group: 'desktop' | 'mobile' | 'tools' | 'terminal' | 'more'
  authors?: { name: string; userName: string }[]
  links?: ClientLink[]
  recommended?: boolean
  retired?: boolean
  comingSoon?: boolean
}

const clientIcon = (name: string) => `https://fishpi.cn/images/clients/${name}`

const clients: ClientApp[] = [
  {
    id: 'windows',
    name: 'Windows 客户端',
    icon: clientIcon('windows.png'),
    group: 'desktop',
    authors: [{ name: 'imlinhanchao', userName: 'imlinhanchao' }],
    links: [{ label: 'Github Releases', href: 'https://github.com/imlinhanchao/fishpi-desktop/releases' }],
  },
  {
    id: 'macos',
    name: 'macOS 客户端',
    icon: clientIcon('macos.png'),
    group: 'desktop',
    authors: [{ name: 'imlinhanchao', userName: 'imlinhanchao' }],
    links: [{ label: 'Github Releases', href: 'https://github.com/imlinhanchao/fishpi-desktop/releases' }],
  },
  {
    id: 'android-recommended',
    name: 'Android 客户端',
    icon: clientIcon('android.png'),
    group: 'mobile',
    authors: [{ name: 'otis1026', userName: 'otis1026' }],
    links: [{ label: '详细地址', href: '/article/1745833503658' }],
    recommended: true,
  },
  {
    id: 'android-native',
    name: 'Android 客户端（原生）',
    icon: clientIcon('android.png'),
    group: 'mobile',
    authors: [{ name: 'csfwff', userName: 'csfwff' }],
    links: [{ label: '详细地址', href: '/article/1656144820684' }],
  },
  {
    id: 'vscode',
    name: 'VSCode 插件',
    icon: clientIcon('vscode.png'),
    group: 'tools',
    authors: [{ name: 'imlinhanchao', userName: 'imlinhanchao' }],
    links: [{ label: 'Visual Studio Marketplace', href: 'https://marketplace.visualstudio.com/items?itemName=hancel.pwl-chat' }],
  },
  {
    id: 'utools',
    name: 'uTools 插件',
    icon: clientIcon('utools.png'),
    group: 'tools',
    authors: [{ name: 'otis1026', userName: 'otis1026' }],
    links: [{ label: '立刻尝鲜', href: '/article/1748939764736' }],
  },
  {
    id: 'chrome',
    name: 'Chrome 插件',
    icon: clientIcon('chrome.png'),
    group: 'tools',
    authors: [{ name: 'Lemon', userName: 'lemon' }],
    links: [
      { label: 'Github Releases', href: 'https://github.com/Lemon-cxh/pwl-chat-extension/releases' },
      {
        label: 'Microsoft Edge Addons',
        href: 'https://microsoftedge.microsoft.com/addons/detail/%E6%91%B8%E9%B1%BC%E6%B4%BE%E8%81%8A%E5%A4%A9%E5%AE%A4/oldbilakhdpiamjbkocdcdnlnakainfm',
      },
      {
        label: 'Chrome 网上应用店',
        href: 'https://chrome.google.com/webstore/detail/%E6%91%B8%E9%B1%BC%E6%B4%BE%E8%81%8A%E5%A4%A9%E5%AE%A4/fkaomdjjdbglkbcmfhhlioejkpacbbpe',
      },
    ],
  },
  {
    id: 'idea',
    name: 'IDEA 插件',
    icon: clientIcon('idea.jpg'),
    group: 'tools',
    authors: [{ name: 'Danbai', userName: 'Danbai' }],
    links: [
      { label: 'Github Releases', href: 'https://github.com/danbai225/pwl-chat/releases' },
      { label: 'IntelliJ IDEs Plugin | Marketplace', href: 'https://plugins.jetbrains.com/plugin/18091-pwl-chat' },
    ],
  },
  {
    id: 'python',
    name: 'Python 客户端',
    icon: clientIcon('python.png'),
    group: 'terminal',
    authors: [{ name: 'Gakkiyomi', userName: 'Gakkiyomi' }],
    links: [{ label: 'Github', href: 'https://github.com/gakkiyomi/pwl-chat-python' }],
  },
  {
    id: 'golang-distributed',
    name: 'Golang 分布式客户端',
    icon: clientIcon('Golang.png'),
    group: 'terminal',
    authors: [{ name: 'bulabula', userName: 'bulabula' }],
    links: [{ label: 'Github', href: 'https://github.com/New-arkssac/fishpi-Goclient' }],
  },
  {
    id: 'golang-terminal',
    name: 'Golang 终端客户端',
    icon: clientIcon('Golang.png'),
    group: 'terminal',
    authors: [{ name: '8888', userName: '8888' }],
    links: [{ label: 'Github Releases', href: 'https://github.com/fghwett/fishpi-golang/releases/' }],
  },
  {
    id: 'coming-soon',
    name: '更多平台开发中…',
    icon: clientIcon('code.png'),
    group: 'more',
    comingSoon: true,
  },
  {
    id: 'ios-retired',
    name: 'iOS 客户端',
    icon: clientIcon('ios.png'),
    group: 'mobile',
    authors: [
      { name: 'Yui', userName: 'Yui' },
      { name: 'iwpz', userName: 'iwpz' },
    ],
    retired: true,
  },
  {
    id: 'android-retired',
    name: 'Android 客户端',
    icon: clientIcon('android.png'),
    group: 'mobile',
    authors: [
      { name: 'Yui', userName: 'Yui' },
      { name: 'iwpz', userName: 'iwpz' },
    ],
    retired: true,
  },
  {
    id: 'android-flutter-retired',
    name: 'Android 客户端（Flutter）',
    icon: clientIcon('android.png'),
    group: 'mobile',
    authors: [{ name: 'iwpz', userName: 'iwpz' }],
    retired: true,
  },
]

const clientGroups = [
  { id: 'desktop', title: '桌面客户端', subtitle: '在电脑上也能轻松连接摸鱼派' },
  { id: 'mobile', title: '移动客户端', subtitle: '随时查看消息与社区动态' },
  { id: 'tools', title: '插件与效率工具', subtitle: '融入浏览器和日常开发环境' },
  { id: 'terminal', title: '命令行客户端', subtitle: '为终端与自动化场景准备' },
  { id: 'more', title: '更多选择', subtitle: '新的客户端正在路上' },
] as const

const availableClients = (group: ClientApp['group']) => clients.filter(client => client.group === group && !client.retired)
const retiredClients = clients.filter(client => client.retired)
</script>

<template>
  <section class="download-page">
    <header class="hero">
      <div class="hero-copy">
        <span class="eyebrow"><span class="eyebrow-dot"></span>摸鱼派 · 多端客户端</span>
        <h1>把摸鱼派<br /><span>装进你的设备</span></h1>
        <p>电脑、手机、浏览器与开发工具，总有一种适合你的摸鱼方式。</p>
        <div class="hero-meta">
          <span>官方与社区客户端</span>
          <i aria-hidden="true"></i>
          <span>持续更新中</span>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="orbit orbit-one"></div>
        <div class="orbit orbit-two"></div>
        <div class="hero-icon"><img :src="clientIcon('code.png')" alt="" /></div>
        <span class="orbit-label label-desktop">DESKTOP</span>
        <span class="orbit-label label-mobile">MOBILE</span>
        <span class="orbit-label label-tools">TOOLS</span>
      </div>
    </header>

    <div class="section-list">
      <section v-for="group in clientGroups" :key="group.id" class="client-section" :aria-labelledby="`section-${group.id}`">
        <header class="section-heading">
          <div>
            <h2 :id="`section-${group.id}`">{{ group.title }}</h2>
            <p>{{ group.subtitle }}</p>
          </div>
          <span class="section-count">{{ availableClients(group.id).length.toString().padStart(2, '0') }}</span>
        </header>
        <ul class="client-grid" :class="{ 'more-grid': group.id === 'more' }">
          <li v-for="client in availableClients(group.id)" :key="client.id" class="client-card" :class="{ recommended: client.recommended, 'coming-soon': client.comingSoon }">
            <div class="client-main">
              <div class="icon-wrap" :class="{ 'icon-muted': client.comingSoon }">
                <img :src="client.icon" :alt="`${client.name}图标`" width="48" height="48" loading="lazy" />
              </div>
              <div class="client-title">
                <span v-if="client.recommended" class="recommend-label">推荐</span>
                <span v-if="client.comingSoon" class="recommend-label soon-label">即将推出</span>
                <h3>{{ client.name }}</h3>
                <div v-if="client.authors?.length" class="authors">
                  <span>开发者</span>
                  <template v-for="(author, index) in client.authors" :key="author.userName">
                    <RouterLink :to="`/member/${author.userName}`">{{ author.name }}</RouterLink>
                    <span v-if="index < client.authors.length - 1" class="author-separator" aria-hidden="true">·</span>
                  </template>
                </div>
                <p v-else class="authors">期待新的社区作品</p>
              </div>
            </div>
            <div v-if="client.links?.length" class="client-links">
              <a
                v-for="(link, index) in client.links"
                :key="link.href"
                :class="{ 'primary-link': client.recommended && index === 0 }"
                :href="link.href"
                :target="link.href.startsWith('/') ? undefined : '_blank'"
                :rel="link.href.startsWith('/') ? undefined : 'noopener noreferrer'"
              >{{ link.label }} <span aria-hidden="true">↗</span></a>
            </div>
            <p v-else class="coming-note">敬请期待，更多平台正在开发中。</p>
          </li>
        </ul>
      </section>
    </div>

    <section v-if="retiredClients.length" class="retired-section" aria-labelledby="retired-heading">
      <header class="section-heading retired-heading">
        <div>
          <h2 id="retired-heading">已下架客户端</h2>
          <p>以下版本已停止提供下载，感谢开发者曾经的贡献。</p>
        </div>
        <span class="retired-count">{{ retiredClients.length }} 个</span>
      </header>
      <ul class="retired-list">
        <li v-for="client in retiredClients" :key="client.id" class="retired-card">
          <img :src="client.icon" :alt="`${client.name}图标`" width="36" height="36" loading="lazy" />
          <div class="retired-info">
            <div class="retired-title"><h3>{{ client.name }}</h3><span class="retired-tag">已下架</span></div>
            <div class="authors">
              <span>开发者</span>
              <template v-for="(author, index) in (client.authors ?? [])" :key="author.userName">
                <RouterLink :to="`/member/${author.userName}`">{{ author.name }}</RouterLink>
                <span v-if="index < (client.authors?.length ?? 0) - 1" class="author-separator" aria-hidden="true">·</span>
              </template>
            </div>
          </div>
          <span class="retired-note">暂无下载</span>
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.download-page {
  --download-accent: var(--fp-primary, #4c9e75);
  --download-accent-soft: color-mix(in srgb, var(--download-accent) 12%, var(--fp-card));
  max-width: 1120px;
  margin: 0 auto;
  padding: 26px 0 54px;
}
.hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 258px;
  overflow: hidden;
  padding: 36px 54px;
  border: 1px solid color-mix(in srgb, var(--download-accent) 18%, var(--fp-border));
  border-radius: 20px;
  background:
    radial-gradient(ellipse at 85% 12%, color-mix(in srgb, var(--download-accent) 19%, transparent), transparent 36%),
    linear-gradient(115deg, color-mix(in srgb, var(--download-accent) 8%, var(--fp-card)), var(--fp-card) 65%);
  box-shadow: var(--fp-card-shadow);
}
.hero-copy {
  position: relative;
  z-index: 1;
  max-width: 600px;
}
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--download-accent);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: .04em;
}
.eyebrow-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--download-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--download-accent) 13%, transparent);
}
.hero h1 {
  margin: 17px 0 10px;
  color: var(--fp-title);
  font-size: clamp(34px, 4.5vw, 48px);
  font-weight: 760;
  letter-spacing: -.045em;
  line-height: 1.12;
}
.hero h1 span {
  color: var(--download-accent);
}
.hero-copy > p {
  max-width: 470px;
  margin: 0;
  color: var(--fp-muted);
  font-size: 15px;
  line-height: 1.7;
}
.hero-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 23px;
  color: var(--fp-muted);
  font-size: 12px;
}
.hero-meta i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--download-accent);
}
.hero-art {
  position: relative;
  flex: 0 0 250px;
  width: 250px;
  height: 190px;
  margin-right: 18px;
}
.orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1px solid color-mix(in srgb, var(--download-accent) 25%, var(--fp-border));
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.orbit-one { width: 142px; height: 142px; }
.orbit-two { width: 210px; height: 210px; border-style: dashed; opacity: .65; }
.hero-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: 86px;
  height: 86px;
  place-items: center;
  border: 1px solid var(--fp-border);
  border-radius: 25px;
  background: var(--fp-card);
  box-shadow: 0 12px 35px color-mix(in srgb, var(--download-accent) 18%, transparent);
  transform: translate(-50%, -50%) rotate(-7deg);
}
.hero-icon img { width: 52px; height: 52px; object-fit: contain; }
.orbit-label {
  position: absolute;
  padding: 5px 9px;
  border: 1px solid var(--fp-border);
  border-radius: 7px;
  background: var(--fp-card);
  color: var(--fp-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .09em;
  box-shadow: var(--fp-card-shadow);
}
.label-desktop { top: 14px; left: 30px; }
.label-mobile { top: 72px; right: -3px; }
.label-tools { bottom: 11px; left: 79px; }
.section-list {
  display: flex;
  flex-direction: column;
  gap: 34px;
  margin-top: 38px;
}
.client-section,
.retired-section { min-width: 0; }
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.section-heading h2 {
  margin: 0;
  color: var(--fp-title);
  font-size: 20px;
  font-weight: 720;
  letter-spacing: -.02em;
}
.section-heading p {
  margin: 5px 0 0;
  color: var(--fp-muted);
  font-size: 12px;
  line-height: 1.5;
}
.section-count {
  color: color-mix(in srgb, var(--fp-muted) 74%, transparent);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}
.client-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.client-grid.more-grid { grid-template-columns: minmax(0, 1fr); }
.client-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-width: 0;
  padding: 17px 18px;
  border: 1px solid var(--fp-border);
  border-radius: 13px;
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  transition: border-color 180ms ease, background-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}
.client-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--download-accent) 38%, var(--fp-border));
  background: color-mix(in srgb, var(--download-accent) 2.5%, var(--fp-card));
  box-shadow: 0 9px 24px color-mix(in srgb, var(--download-accent) 8%, transparent), var(--fp-card-shadow);
}
.client-card.recommended {
  border-color: color-mix(in srgb, var(--download-accent) 42%, var(--fp-border));
  background: linear-gradient(110deg, color-mix(in srgb, var(--download-accent) 7%, var(--fp-card)), var(--fp-card) 60%);
}
.client-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  flex: 1;
}
.icon-wrap {
  display: grid;
  flex: 0 0 56px;
  width: 56px;
  height: 56px;
  place-items: center;
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--fp-bg) 62%, var(--fp-card));
}
.icon-wrap img {
  display: block;
  width: 42px;
  height: 42px;
  object-fit: contain;
}
.icon-muted { opacity: .75; }
.client-title { min-width: 0; }
.client-title h3,
.retired-title h3 {
  margin: 2px 0 5px;
  color: var(--fp-title);
  font-size: 15px;
  font-weight: 680;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.recommend-label {
  display: inline-flex;
  padding: 2px 6px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--download-accent) 13%, transparent);
  color: var(--download-accent);
  font-size: 10px;
  font-weight: 650;
  line-height: 1.3;
}
.soon-label { background: var(--fp-hover); color: var(--fp-muted); }
.authors {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 6px;
  color: var(--fp-muted);
  font-size: 11px;
  line-height: 1.55;
}
.authors > span:first-child { opacity: .75; }
.authors a {
  color: var(--fp-link);
  text-decoration: none;
}
.authors a:hover { text-decoration: underline; }
.author-separator { color: var(--fp-muted); }
.client-links {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  max-width: 43%;
}
.client-links a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 30px;
  padding: 5px 9px;
  border: 1px solid var(--fp-border);
  border-radius: 7px;
  background: var(--fp-card);
  color: var(--fp-link);
  font-size: 11px;
  line-height: 1.3;
  text-align: center;
  text-decoration: none;
  transition: border-color 150ms ease, background-color 150ms ease;
}
.client-links a:hover {
  border-color: color-mix(in srgb, var(--download-accent) 38%, var(--fp-border));
  background: var(--download-accent-soft);
  text-decoration: underline;
}
.client-links a.primary-link {
  border-color: var(--download-accent);
  background: var(--download-accent);
  color: #fff;
}
.client-links a.primary-link:hover { text-decoration: underline; }
.coming-soon {
  border-style: dashed;
  background: color-mix(in srgb, var(--fp-hover) 35%, var(--fp-card));
}
.coming-note {
  flex: 0 0 auto;
  margin: 0;
  color: var(--fp-muted);
  font-size: 11px;
}
.retired-section {
  margin-top: 42px;
  padding-top: 25px;
  border-top: 1px solid var(--fp-border);
}
.retired-heading { margin-bottom: 13px; }
.retired-heading h2 { font-size: 17px; }
.retired-count,
.retired-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--fp-hover);
  color: var(--fp-muted);
  font-size: 10px;
}
.retired-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.retired-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 11px 13px;
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--fp-bg) 36%, var(--fp-card));
}
.retired-card > img { flex: 0 0 36px; width: 36px; height: 36px; object-fit: contain; opacity: .7; }
.retired-info { min-width: 0; flex: 1; }
.retired-title { display: flex; flex-wrap: wrap; align-items: center; gap: 0 7px; }
.retired-title h3 { margin: 0 0 3px; color: var(--fp-muted); font-size: 13px; }
.retired-tag { margin-bottom: 3px; padding: 2px 5px; font-size: 9px; }
.retired-note { flex: 0 0 auto; color: var(--fp-muted); font-size: 10px; }
@media (max-width: 780px) {
  .download-page { padding: 18px 0 42px; }
  .hero { min-height: 228px; padding: 30px; }
  .hero-art { flex-basis: 190px; width: 190px; margin-right: 0; transform: scale(.88); }
  .client-card { align-items: flex-start; flex-direction: column; gap: 12px; }
  .client-links { justify-content: flex-start; max-width: 100%; }
}
@media (max-width: 600px) {
  .download-page { padding: 12px 0 32px; }
  .hero { min-height: 0; padding: 26px 22px; border-radius: 15px; }
  .hero h1 { margin-top: 14px; font-size: 35px; }
  .hero-copy > p { max-width: 340px; font-size: 13px; }
  .hero-meta { margin-top: 17px; font-size: 10px; }
  .hero-art { position: absolute; right: -58px; bottom: -38px; width: 180px; opacity: .34; transform: scale(.78); }
  .section-list { gap: 27px; margin-top: 30px; }
  .section-heading h2 { font-size: 18px; }
  .section-heading p { max-width: 255px; font-size: 11px; }
  .client-grid { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .client-card { align-items: center; flex-direction: row; gap: 8px; padding: 12px; border-radius: 11px; }
  .client-main { gap: 11px; }
  .icon-wrap { flex-basis: 46px; width: 46px; height: 46px; border-radius: 10px; }
  .icon-wrap img { width: 35px; height: 35px; }
  .client-title h3 { font-size: 13px; }
  .authors { font-size: 10px; }
  .client-links { justify-content: flex-end; }
  .client-links a { min-height: 28px; padding: 4px 7px; font-size: 10px; }
  .client-links a:not(:first-child) { display: none; }
  .client-links:has(a:only-child) a,
  .client-links a.primary-link { display: inline-flex; }
  .coming-soon { align-items: flex-start; flex-direction: column; }
  .coming-note { padding-left: 57px; }
  .retired-section { margin-top: 32px; padding-top: 20px; }
  .retired-list { grid-template-columns: minmax(0, 1fr); }
  .retired-card { padding: 9px 11px; }
  .retired-note { font-size: 9px; }
}
@media (prefers-reduced-motion: reduce) {
  .client-card { transition: none; }
  .client-card:hover { transform: none; }
}
</style>
