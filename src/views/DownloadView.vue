<script setup lang="ts">
import { usePageSeo } from '@/composables/usePageSeo'

usePageSeo(() => ({
  title: '客户端下载',
  path: '/download',
  description: '下载摸鱼派各端客户端，随时随地摸鱼。',
}))

const clients = [
  {
    name: 'Windows / macOS',
    icon: 'https://fishpi.cn/images/clients/windows.png',
    author: 'imlinhanchao',
    href: 'https://github.com/imlinhanchao/fishpi-desktop/releases',
    note: '桌面客户端',
  },
  {
    name: 'iOS',
    icon: 'https://fishpi.cn/images/clients/ios.png',
    author: 'Yui / iwpz',
    href: 'https://apps.apple.com/cn/app/%E6%91%B8%E9%B1%BC%E6%B4%BE/id1617385824',
    note: 'App Store',
  },
  {
    name: 'Android（社区版）',
    icon: 'https://fishpi.cn/images/clients/android.png',
    author: 'rLingMX',
    href: 'https://github.com/rLingMX/pwl-chat-uniapp/releases',
    note: 'GitHub Releases',
  },
  {
    name: 'VS Code',
    icon: 'https://fishpi.cn/images/clients/vscode.png',
    author: 'imlinhanchao',
    href: 'https://marketplace.visualstudio.com/items?itemName=hancel.pwl-chat',
    note: '扩展市场',
  },
]
</script>

<template>
  <section class="card">
    <h1>客户端下载</h1>
    <p class="lead">随时随地摸鱼？选一个趁手的客户端吧。</p>
    <ul class="list">
      <li v-for="c in clients" :key="c.name">
        <img :src="c.icon" alt="" />
        <div>
          <b>{{ c.name }}</b>
          <p>{{ c.note }} · {{ c.author }}</p>
        </div>
        <a class="btn" :href="c.href" target="_blank" rel="noreferrer">下载</a>
      </li>
    </ul>
    <p class="hint">更多安卓变体与说明见现网 <a href="https://fishpi.cn/download" target="_blank" rel="noreferrer">fishpi.cn/download</a>。</p>
  </section>
</template>

<style scoped>
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 20px 22px;
}
h1 {
  margin: 0 0 8px;
  font-size: 20px;
  color: var(--fp-title);
}
.lead {
  margin: 0 0 16px;
  color: var(--fp-muted);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
li {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border: 1px solid var(--fp-border);
  border-radius: 10px;
}
img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}
b {
  display: block;
  margin-bottom: 4px;
}
p {
  margin: 0;
  font-size: 13px;
  color: var(--fp-muted);
}
a {
  color: var(--fp-link);
}
.btn {
  margin-left: auto;
  background: var(--fp-green);
  color: #fff;
  text-decoration: none;
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 13px;
  white-space: nowrap;
}
.hint {
  margin-top: 16px;
  font-size: 13px;
  color: var(--fp-muted);
}
</style>
