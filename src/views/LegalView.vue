<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePageSeo } from '@/composables/usePageSeo'

const route = useRoute()
const kind = computed(() => (route.meta.legal === 'privacy' ? 'privacy' : 'agreement'))
const title = computed(() => (kind.value === 'privacy' ? '隐私政策' : '用户协议'))
const official = computed(() =>
  kind.value === 'privacy' ? 'https://fishpi.cn/privacy' : 'https://fishpi.cn/agreement',
)

usePageSeo(() => ({
  title: title.value,
  path: route.path,
  description: `摸鱼派${title.value}`,
  robots: 'index,follow',
}))
</script>

<template>
  <section class="card">
    <h1>{{ title }}</h1>
    <p v-if="kind === 'agreement'">
      使用摸鱼派即表示你同意遵守社区规范：友善交流、不传播违法违规内容、尊重他人知识产权与隐私，并接受站点运营方对违规行为的处理措施。
    </p>
    <p v-else>
      摸鱼派会处理账号、发帖与互动等必要数据以提供社区服务。我们不会无偿出售你的个人信息；在法律要求或经你授权的情况下，可能向第三方提供必要信息。
    </p>
    <p class="hint">
      以上为简要说明。完整条款以官方页面为准：
      <a :href="official" target="_blank" rel="noreferrer">{{ official }}</a>
    </p>
  </section>
</template>

<style scoped>
.card {
  max-width: 720px;
  margin: 0 auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 22px 24px;
  line-height: 1.7;
}
h1 {
  margin: 0 0 12px;
  font-size: 20px;
  color: var(--fp-title);
}
p {
  margin: 0 0 12px;
  color: var(--fp-text);
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
a {
  color: var(--fp-link);
}
</style>
