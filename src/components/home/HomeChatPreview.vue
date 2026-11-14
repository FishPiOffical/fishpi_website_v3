<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { ChatLine } from '@/stores/chat'
import { avatarStyle, avatarUrl, rhyPicThumbnail } from '@/utils/avatar'
import VipNickname from '@/components/user/VipNickname.vue'

const props = defineProps<{ message: ChatLine; blurImages?: boolean }>()
const emit = defineEmits<{ preview: [url: string] }>()
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const preview = computed(() => {
  const message = props.message
  if (message.redPacket) return { text: '[红包]', image: '' }
  if (message.card) return { text: message.card.msgType === 'music' ? `[音乐] ${message.card.title || '音乐分享'}` : '[天气]', image: '' }
  if (!mounted.value) return { text: '', image: '' }
  // 只从已清洗正文提取摘要，不挂载富文本，避免大图、引用和代码块撑高首页。
  const template = document.createElement('template')
  template.innerHTML = message.html || ''
  template.content.querySelectorAll('script,style').forEach(node => node.remove())
  let image = ''
  let images = 0
  for (const node of template.content.querySelectorAll('img')) {
    if (node.classList.contains('emoji')) { node.replaceWith(node.alt || '[表情]'); continue }
    images++
    const src = node.getAttribute('src') || ''
    if (!image && /^https?:\/\//i.test(src)) image = src
    node.replaceWith(' ')
  }
  template.content.querySelectorAll('p,div,blockquote,li,pre,br').forEach(node => node.append(' '))
  const text = (template.content.textContent || '').replace(/\s+/g, ' ').trim()
  return { text: `${text}${images ? `${text ? ' ' : ''}[${images > 1 ? `${images} 张` : ''}图片]` : ''}` || '[消息]', image }
})
</script>

<template>
  <div class="home-chat-preview">
    <RouterLink v-if="message.userName" class="preview-avatar" :to="`/member/${encodeURIComponent(message.userName)}`" :data-user-card="message.userName" :aria-label="`查看 ${message.userNickname || message.userName} 的主页`" :style="avatarStyle(avatarUrl(message), 20)" />
    <RouterLink v-if="message.userName" class="preview-name" :to="`/member/${encodeURIComponent(message.userName)}`">
      <VipNickname :user-id="message.userOId" :user-name="message.userName">{{ message.userNickname || message.userName }}</VipNickname>
    </RouterLink>
    <RouterLink class="preview-text" :to="`/cr#chatroom${message.oId}`">{{ preview.text }}</RouterLink>
    <button v-if="preview.image" type="button" class="preview-image" aria-label="查看消息图片" @click="emit('preview', preview.image)">
      <img :src="rhyPicThumbnail(preview.image, 36, 36)" :class="{ blurred: blurImages }" alt="消息图片" loading="lazy" />
    </button>
  </div>
</template>

<style scoped>
.home-chat-preview { position: relative; border-radius: 6px; transition: background-color .15s ease; display: flex; align-items: center; gap: 7px; min-width: 0; min-height: 38px; width: 100%; }
.preview-avatar { width: 20px; height: 20px; flex: none; border-radius: 4px; background: var(--fp-border) center / cover no-repeat; }
.preview-name { flex: 0 1 auto; max-width: 28%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--fp-muted); font-size: 12px; }
.preview-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; line-height: 20px; color: var(--fp-text); }
.preview-name, .preview-text { text-decoration: none; }
.home-chat-preview:hover, .home-chat-preview:focus-within { background: var(--fp-hover); }
.preview-name:hover, .preview-text:hover { text-decoration: none; }
.preview-text::after { content: ""; position: absolute; inset: 0; border-radius: 6px; }
.preview-text:focus-visible::after { outline:2px solid var(--fp-primary); outline-offset:2px; }
.preview-avatar, .preview-name, .preview-image { position: relative; z-index: 1; }
@media (prefers-reduced-motion: reduce) { .home-chat-preview { transition: none; } }
.preview-image { flex: none; width: 36px; height: 36px; padding: 0; overflow: hidden; border: 1px solid var(--fp-border); border-radius: 5px; background: var(--fp-bg); cursor: zoom-in; }
.preview-image img { display: block; width: 100%; height: 100%; object-fit: contain; }
.preview-image img.blurred { filter: blur(5px); }
</style>
