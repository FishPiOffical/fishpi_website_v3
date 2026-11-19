<script setup lang="ts">
import { ref, watch } from 'vue'
import { readPartnerActivity, type PartnerFeed } from '@/api/v3-partners'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ snapshot: object }>()
const auth = useAuthStore()
const kind = ref<PartnerFeed>('events'), before = ref(''), retry = ref(0)
const feed = ref<Awaited<ReturnType<typeof readPartnerActivity>> | null>(null)
const error = ref('')
const labels: Record<string,string> = {
  'partner-income':'营业收入', 'partner-slot':'解锁搭子位', 'partner-hire':'请搭子支出',
  'partner-return':'转手或解约到账', 'partner-share':'转手分成',
}
watch([() => props.snapshot, kind], () => { before.value = '' }, { flush:'sync' })
watch([() => props.snapshot, kind, before, retry, () => auth.account?.oId, getAuthContextVersion], async (_, __, cleanup) => {
  let current = true
  cleanup(() => { current = false })
  feed.value = null
  error.value = ''
  if (!auth.isLoggedIn) return
  try {
    const result = await readPartnerActivity(kind.value, before.value)
    if (current) feed.value = result
  } catch (e) { if (current) error.value = e instanceof Error ? e.message : '记录读取失败' }
}, { immediate:true })
</script>
<template>
  <section class="activity">
    <header><h2>最近动态</h2><div role="group" aria-label="记录类型">
      <button :aria-pressed="kind==='events'" @click="kind='events'">搭班动态</button>
      <button :aria-pressed="kind==='wallet'" @click="kind='wallet'">我的收支</button>
    </div></header>
    <p v-if="error" role="alert">{{ error }} <button @click="retry++">重试</button></p>
    <p v-else-if="!feed" role="status">正在读取…</p>
    <template v-else>
      <p v-if="!feed.list.length">{{ kind==='events' ? '还没有搭班动态。' : '还没有搭子收支记录。' }}</p>
      <ul v-else><li v-for="item in feed.list" :key="item.id">
        <div><strong>{{ item.summary || labels[item.operation] || '搭子收支' }}</strong>
          <small>{{ new Date(item.time).toLocaleString('zh-CN') }}<template v-if="item.price"> · 成交 {{ item.price }} 币</template></small></div>
        <span v-if="item.amount" :class="{ gain:item.amount>0 }">{{ item.amount>0 ? '+' : '' }}{{ item.amount }} 币</span>
      </li></ul>
      <footer v-if="before || feed.next"><button v-if="before" @click="before=''">最新记录</button><button v-if="feed.next" @click="before=feed.next">更早记录</button></footer>
    </template>
  </section>
</template>
<style scoped>
.activity { padding:clamp(16px,2vw,24px); border:1px solid var(--fp-border); border-radius:var(--fp-panel-radius); background:var(--fp-card); }
header,li,footer { display:flex; align-items:center; justify-content:space-between; gap:10px; }
header { flex-wrap:wrap; } h2 { margin:0; font-size:18px; }
button { border:0; border-radius:6px; padding:7px 10px; background:transparent; font:inherit; color:var(--fp-muted); cursor:pointer; }
button[aria-pressed=true] { background:var(--fp-primary-soft); color:var(--fp-primary-ink); }
ul { padding:0; margin:12px 0 0; list-style:none; } li { padding:10px 0; border-top:1px solid var(--fp-border); }
li div { min-width:0; overflow-wrap:anywhere; } li span { white-space:nowrap; font-variant-numeric:tabular-nums; }
small { display:block; margin-top:4px; color:var(--fp-muted); } .gain { color:var(--fp-primary-ink); } footer { justify-content:flex-end; }
</style>
