<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import FpDialog from '@/components/FpDialog.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { useGeetest4 } from '@/composables/useGeetest4'
import { useAuthStore } from '@/stores/auth'
import { useParkingStore } from '@/stores/parking'
import type { ParkingCar, ParkingSession } from '@/api/v3-parking'

usePageSeo(() => ({ title: '抢车位', path: '/parking', robots: 'noindex' }))
const game = useParkingStore(), auth = useAuthStore()
const selected = ref(''), purchase = ref<ParkingCar | null>(null), captchaEl = ref<HTMLElement | null>(null)
const captcha = useGeetest4(captchaEl, proof => { void game.verification(proof) })
const current = ref(0), mounted = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
const activeCar = computed(() => game.state?.owned.includes(selected.value) ? selected.value : game.state?.owned[0] || '')
const locked = computed(() => game.busy || !!game.pending || game.loading)
const carName = (id: string) => game.state?.catalog.find(c => c.id === id)?.name || id
const art = (id: string) => '/images/parking/' + id + '.webp'
function estimate(s: ParkingSession) {
  const now = (game.state?.serverNow || 0) + Math.max(0, current.value - game.receivedAt)
  return Math.max(s.earned, Math.floor(Math.min(8 * 3600000, Math.max(0, now - s.startedAt)) * s.rate / 3600000))
}
function confirmPurchase() {
  const car = purchase.value
  purchase.value = null
  if (car && !locked.value) void game.submit({ action: 'buy', car: car.id })
}
watch(() => game.challenge, async c => {
  captcha.destroy()
  if (c) { await nextTick(); if (game.challenge === c) await captcha.mount('float', c.captchaId) }
}, { flush: 'post' })
function refresh() { if (mounted.value && auth.accessToken && auth.account?.oId && !game.busy) void game.load() }
watch([() => auth.account?.oId, () => !!auth.accessToken], () => {
  selected.value = ''; purchase.value = null; refresh()
})
onMounted(() => {
  mounted.value = true; current.value = Date.now(); refresh()
  timer = setInterval(() => { current.value = Date.now() }, 1000)
  window.addEventListener('focus', refresh)
})
onBeforeUnmount(() => { clearInterval(timer); window.removeEventListener('focus', refresh) })
</script>

<template>
  <main class="parking fp-page fp-page--wide fp-ui">
    <header class="mast">
      <div><RouterLink to="/games">游戏 / 鱼游</RouterLink><h1>抢车位</h1></div>
      <div v-if="game.state" class="balance"><button :disabled="locked" @click="game.load()">刷新</button><div class="wallet"><span>游园币余额</span><strong>{{ game.state.coins.toLocaleString() }}</strong></div></div>
    </header>
    <p v-if="game.message" role="status" class="notice">{{ game.message }}</p>
    <div v-if="game.pending" class="controls">
      <button v-if="game.needsProof" :disabled="game.busy" @click="game.verification()">完成安全验证</button>
      <button v-else :disabled="game.busy" @click="game.run()">继续原操作</button>
      <button v-if="game.needsProof" :disabled="game.busy" @click="game.cancelVerifiedFailure()">暂不停车</button>
    </div>
    <p v-if="game.readError" role="alert">{{ game.readError }} <button @click="game.load()">重新读取</button></p>
    <p v-else-if="!game.state" role="status">正在读取车库…</p>
    <template v-if="game.state">
      <section v-if="game.state.owned.length" class="lot">
        <article v-for="side in (['driving', 'occupant'] as const)" :key="side">
          <h2>{{ side === 'driving' ? '我的车辆' : '我的车位' }}</h2>
          <template v-if="game.state[side]">
            <img class="parked" :src="art(game.state[side].car)" :alt="carName(game.state[side].car)" width="112" height="80" />
            <h3>{{ carName(game.state[side].car) }}</h3>
            <p>{{ side === 'driving' ? '停在 ' + game.state[side].otherName + ' 的车位' : '车主 · ' + game.state[side].otherName }}</p>
            <p>预计{{ side === 'driving' ? '收入' : '车主收入' }} <strong>{{ estimate(game.state[side]) }}</strong> 游园币</p>
            <button :disabled="locked" @click="game.submit({ action: side === 'driving' ? 'collect' : 'ticket', sessionId: game.state[side].id })">{{ side === 'driving' ? '收车结算' : '贴条清位' }}</button>
          </template>
          <p v-else>{{ side === 'driving' ? '车辆已回库，可以出发。' : '车位空闲，邻居可以停进来。' }}</p>
        </article>
      </section>
      <section v-if="game.state.owned.length && !game.state.driving" class="spaces">
        <h2>邻居的空车位</h2>
        <label>选择车辆 <select v-model="selected" :disabled="locked"><option value="">{{ carName(game.state.owned[0]!) }}</option><option v-for="id in game.state.owned.slice(1)" :key="id" :value="id">{{ carName(id) }}</option></select></label>
        <ul><li v-for="space in game.state.spaces" :key="space.id"><span>{{ space.name }}</span><button :disabled="locked" @click="game.submit({ action: 'park', car: activeCar, hostId: space.id })">停在这里</button></li></ul>
        <p v-if="!game.state.spaces.length">目前没有空车位。好友领取初始车后，也会开放一个车位。</p>
        <button v-if="game.state.next" :disabled="locked" @click="game.load(game.state.next)">下一批车位</button>
      </section>
      <section v-if="game.state.recent.length" class="spaces">
        <h2>最近结算</h2>
        <ol class="settlements"><li v-for="entry in game.state.recent" :key="entry.id">
          <span>{{ carName(entry.car) }} · {{ entry.ending === 'ticket' ? '被贴条' : '主动收车' }}</span>
          <strong>+{{ entry.paid }} 游园币</strong>
        </li></ol>
      </section>
      <section><h2>{{ game.state.owned.length ? '游园车行' : '免费选一辆初始车' }}</h2>
        <p class="muted">按实际停放时间计费，每次最多 8 小时。收车或被贴条时，收益进入车主钱包。</p>
        <div class="cars"><article v-for="car in game.state.catalog.filter(c => game.state!.owned.length || c.starter)" :key="car.id">
          <img :src="art(car.id)" :alt="car.name" loading="lazy" width="320" height="188" />
          <div class="details"><h3>{{ car.name }}</h3><p>{{ car.rate }} 币/小时 · 单次最多 {{ car.rate * 8 }} 币</p>
            <button v-if="!game.state.owned.length" :disabled="locked" @click="game.submit({ action: 'starter', car: car.id })">免费领取</button>
            <span v-else-if="game.state.owned.includes(car.id)" class="owned">已入库</span>
            <button v-else :disabled="locked || game.state.coins < car.price" @click="purchase = car">{{ car.price.toLocaleString() }} 游园币购买</button>
          </div>
        </article></div>
      </section>
    </template>
    <FpDialog :open="!!purchase" title="确认购车" @close="purchase = null">
      <template v-if="purchase"><p>花费 {{ purchase.price.toLocaleString() }} 游园币购买「{{ purchase.name }}」？</p><button :disabled="locked" @click="confirmPurchase">确认购买</button></template>
    </FpDialog>
    <FpDialog :open="!!game.challenge" title="停车验证" @close="game.challenge = null">
      <div ref="captchaEl" /><p v-if="captcha.error.value" role="alert">{{ captcha.error.value }}</p>
    </FpDialog>
  </main>
</template>

<style scoped>
.parking { display:grid; gap:20px; color:var(--fp-text); }
.mast,.balance,.controls,.spaces li { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.mast a,.muted,.parking p,.wallet span { color:var(--fp-muted); }
.parking h1,.parking h2,.parking h3 { color:var(--fp-title); margin:0; }
.parking h1 { font-size:clamp(25px,4vw,34px); }.parking h2 { font-size:19px; }.parking h3 { font-size:16px; }
.parking p { margin:8px 0; line-height:1.55; }
.wallet { display:grid; text-align:right; }.wallet strong { font-size:24px; font-variant-numeric:tabular-nums; }
.lot,.cars { display:grid; gap:14px; }.lot { grid-template-columns:repeat(2,minmax(0,1fr)); }
.cars { grid-template-columns:repeat(auto-fit,minmax(min(215px,100%),1fr)); margin-top:12px; }
.parking article,.spaces { background:var(--fp-card); border:1px solid var(--fp-border); border-radius:12px; }
.lot article,.spaces,.details { padding:16px; }.cars article { overflow:hidden; }
.cars img { display:block; width:100%; height:148px; object-fit:contain; background:#faedd9; }
.parked { float:right; border-radius:10px; object-fit:contain; background:#faedd9; }
.parking button,.parking select { min-height:36px; padding:6px 12px; font:inherit; font-size:14px; color:var(--fp-text); background:var(--fp-card); border:1px solid var(--fp-border); border-radius:8px; }
.parking button { cursor:pointer; }.parking button:enabled:hover { border-color:var(--fp-primary); }.parking button:disabled { opacity:.55; cursor:default; }
.parking .owned { color:var(--fp-primary); }.spaces label { display:block; margin:12px 0; }
.spaces ul { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr)); gap:8px 20px; padding:0; margin:8px 0; }
.spaces li { padding:6px 0; border-bottom:1px solid var(--fp-border); }.spaces li span { overflow-wrap:anywhere; }.spaces li button { flex:none; }
.settlements { margin:8px 0 0; padding:0; }.settlements strong { white-space:nowrap; }
.controls { justify-content:flex-start; }.notice { padding:8px 12px; background:var(--fp-card); border-left:3px solid var(--fp-primary); }
@media(max-width:600px){.lot { grid-template-columns:1fr; }.cars { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }.cars img { height:105px; }.details { padding:10px; }.details p { font-size:12px; }.parking button { min-height:42px; }}
</style>
