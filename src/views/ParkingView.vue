<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { petSpeciesChoices } from '@/components/pets/species'
import { petBattlePoster, petPortrait } from '@/components/pets/animations'
import { mountAssets } from '@/utils/mounts'
import PetIcon from '@/components/pets/PetIcon.vue'
import FpDialog from '@/components/FpDialog.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { useGeetest4 } from '@/composables/useGeetest4'
import { useAuthStore } from '@/stores/auth'
import { useParkingStore } from '@/stores/parking'
import type { ParkingCar, ParkingSession } from '@/api/v3-parking'

usePageSeo(() => ({ title: '抢车位', path: '/parking', robots: 'noindex' }))
const game = useParkingStore(), auth = useAuthStore()
const route = useRoute()
const note = ref('')
const passengerId = ref('')
const availablePet = computed(() => game.state?.availablePet)
const speciesName = (id: string) => petSpeciesChoices.find(pet => pet.id === id)?.name
watch(() => availablePet.value?.id, () => { passengerId.value = '' })
function fallbackPortrait(event: Event, species: string) {
  const img = event.currentTarget as HTMLImageElement
  const fallback = petBattlePoster(species)
  if (fallback && img.getAttribute('src') !== fallback) img.src = fallback
}
function park(hostId: string) {
  const petId = passengerId.value
  void game.submit({ action: 'park', car: activeCar.value, hostId, ...(note.value ? { note: note.value } : {}),
    ...(petId && petId === availablePet.value?.id ? { petId } : {}) })
}
const notes: Record<string, string> = { hello: '来串个门', thanks: '谢谢你的车位', coffee: '请你喝杯咖啡' }
const target = computed(() => typeof route.query.host === 'string' && /^[1-9][0-9]{0,18}$/.test(route.query.host) ? route.query.host : '')
function setScope(value: 'all' | 'following') {
  game.scope = value
  void game.load()
}
function tripArt(s: ParkingSession) {
  return Object.hasOwn(mountAssets,s.mountStyle) ? mountAssets[s.mountStyle] : art(s.car)
}
const serverTime = computed(() => (game.state?.serverNow || 0) + Math.max(0, current.value - game.receivedAt))
function withinBillingPeriod(s: ParkingSession) {
  return serverTime.value < s.startedAt + 8 * 3600000
}
function protectedTrip(s: ParkingSession) {
  return s.pardoned && withinBillingPeriod(s)
}
const selected = ref(''), purchase = ref<ParkingCar | null>(null), captchaEl = ref<HTMLElement | null>(null)
const captcha = useGeetest4(captchaEl, proof => { void game.verification(proof) })
const current = ref(0), mounted = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
const activeCar = computed(() => game.state?.owned.includes(selected.value) ? selected.value : game.state?.owned[0] || '')
const locked = computed(() => game.busy || !!game.pending || game.loading)
const carName = (id: string) => game.state?.catalog.find(c => c.id === id)?.name || id
const showroom = computed(() => {
  const state = game.state
  return state?.catalog.filter(car => state.owned.includes(car.id) || (car.enabled && (state.owned.length || car.starter))) ?? []
})
const art = (id: string) => '/images/parking/' + id + '.webp'
function estimate(s: ParkingSession) {
  const now = serverTime.value
  return Math.max(s.earned, Math.floor(Math.min(8 * 3600000, Math.max(0, now - s.startedAt)) * s.rate / 3600000))
}
function confirmPurchase() {
  const car = purchase.value
  purchase.value = null
  if (car && !locked.value) void game.submit({ action: 'buy', car: car.id, expectedPrice: car.price })
}
watch(() => game.challenge, async c => {
  captcha.destroy()
  if (c) { await nextTick(); if (game.challenge === c) await captcha.mount('float', c.captchaId) }
}, { flush: 'post' })
function refresh() { if (mounted.value && auth.accessToken && auth.account?.oId && !game.busy) void game.load() }
watch([() => auth.account?.oId, () => !!auth.accessToken], () => {
  passengerId.value = ''; selected.value = ''; note.value = ''; purchase.value = null; game.host = target.value; refresh()
})
watch(target, id => { game.host = id; game.scope = 'all'; if (mounted.value) void game.load() })
onMounted(() => {
  game.host = target.value; game.scope = 'all'
  mounted.value = true; current.value = Date.now(); refresh()
  timer = setInterval(() => { current.value = Date.now() }, 1000)
  window.addEventListener('focus', refresh)
})
onBeforeUnmount(() => { clearInterval(timer); window.removeEventListener('focus', refresh) })
</script>

<template>
  <main class="parking fp-page fp-page--wide fp-ui">
    <header class="mast">
      <div class="mast-title"><RouterLink to="/games">游戏 / 鱼游</RouterLink><h1>抢车位</h1></div>
      <div v-if="game.state" class="balance">
        <div class="wallet"><span><PetIcon name="coin" />游园币余额</span><strong>{{ game.state.coins.toLocaleString() }}</strong></div>
        <div class="mast-actions"><RouterLink to="/top/parking">停车周榜 <span aria-hidden="true">↗</span></RouterLink><button type="button" :disabled="locked" @click="game.load()"><PetIcon name="refresh" />刷新</button></div>
      </div>
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
          <header class="bay-heading"><h2>{{ side === 'driving' ? '我的车辆' : '我的车位' }}</h2>
            <span class="bay-status" :class="{ active: game.state[side] }">{{ side === 'driving' ? (game.state.driving ? '已出发' : '已回库') : (game.state.occupant ? '有车停放' : '空闲') }}</span>
          </header>
          <div class="bay-body">
            <div class="bay-art" :class="{ vacant: side === 'occupant' && !game.state.occupant }">
              <img v-if="game.state[side]" :src="tripArt(game.state[side])" alt="" width="136" height="112" />
              <img v-else-if="side === 'driving'" :src="art(activeCar)" alt="" width="136" height="112" />
              <span v-else aria-hidden="true">P</span>
            </div>
            <div class="bay-info">
              <template v-if="game.state[side]">
                <h3>{{ carName(game.state[side].car) }}</h3>
                <p>{{ side === 'driving' ? '停在 ' + game.state[side].otherName + ' 的车位' : '车主 · ' + game.state[side].otherName }}</p>
                <p>预计{{ side === 'driving' ? '收入' : '车主收入' }} <strong>{{ estimate(game.state[side]) }}</strong> 游园币</p>
                <span v-if="game.state[side].passengerSpecies && speciesName(game.state[side].passengerSpecies)" class="passenger">
                  <img :src="petPortrait(game.state[side].passengerSpecies)" @error="fallbackPortrait($event, game.state[side].passengerSpecies)" width="32" height="32" alt="">
                  副驾 · {{ speciesName(game.state[side].passengerSpecies) }}
                </span>
                <p v-if="notes[game.state[side].note]">便签 · {{ notes[game.state[side].note] }}</p>
                <p v-if="protectedTrip(game.state[side])">已放行，计费期满后可清位。</p>
                <div class="trip-actions"><button v-if="side === 'occupant' && !game.state[side].pardoned && withinBillingPeriod(game.state[side])" :disabled="locked" @click="game.submit({ action: 'pardon', sessionId: game.state[side].id })">放你一马</button>
                <button :disabled="locked || (side === 'occupant' && protectedTrip(game.state[side]))" @click="game.submit({ action: side === 'driving' ? 'collect' : 'ticket', sessionId: game.state[side].id })">{{ side === 'driving' ? '收车结算' : '贴条清位' }}</button></div>
              </template>
              <template v-else>
                <h3>{{ side === 'driving' ? carName(activeCar) : '车位空闲' }}</h3>
                <p>{{ side === 'driving' ? '选个车位，就能出发。' : '鱼友停车后，可以贴条或放行。' }}</p>
              </template>
            </div>
          </div>
        </article>
      </section>
      <div class="dispatch">
        <section v-if="target || (game.state.owned.length && !game.state.driving)" class="spaces">
          <div class="space-head"><h2><PetIcon name="outing" />{{ target ? '鱼友停车场' : '邻居的空车位' }}</h2>
            <RouterLink v-if="target" to="/parking">全部车位</RouterLink>
            <div v-else class="filters"><button v-for="item in (['all','following'] as const)" :key="item" :aria-pressed="game.scope === item" @click="setScope(item)">{{ item === 'all' ? '全部' : '我关注的' }}</button></div>
          </div>
          <p v-if="target && !activeCar">领取初始车后即可停车。</p>
          <p v-else-if="target && game.state.driving">先收回当前车辆，即可停入其他车位。</p>
          <div v-if="activeCar && !game.state.driving" class="trip-options">
            <label>选择车辆 <select v-model="selected" :disabled="locked"><option value="">{{ carName(game.state.owned[0]!) }}</option><option v-for="id in game.state.owned.slice(1)" :key="id" :value="id">{{ carName(id) }}</option></select></label>
            <label>随车便签 <select v-model="note" :disabled="locked"><option value="">不留便签</option><option v-for="(label, key) in notes" :key="key" :value="key">{{ label }}</option></select></label>
            <label v-if="availablePet && speciesName(availablePet.speciesId)" class="passenger-choice">
              <input v-model="passengerId" type="checkbox" :true-value="availablePet.id" false-value="" :disabled="locked">
              <img :src="petPortrait(availablePet.speciesId)" @error="fallbackPortrait($event, availablePet.speciesId)" width="28" height="28" alt="">
              带{{ speciesName(availablePet.speciesId) }}坐副驾
            </label>
          </div>
          <ul class="neighbors"><li v-for="space in game.state.spaces" :key="space.id"><span class="neighbor-name"><i aria-hidden="true">P</i>{{ space.name }}</span><button :disabled="locked || !space.free || !activeCar || !!game.state.driving" @click="park(space.id)">{{ space.free ? '停在这里' : '车位已占用' }}</button></li></ul>
          <p v-if="!game.state.spaces.length">{{ target ? '这位鱼友尚未开放车位。' : game.scope === 'following' ? '关注的鱼友暂时没有空车位。' : '目前没有空车位。' }}</p>
          <button v-if="game.state.next" :disabled="locked" @click="game.load(game.state.next)">下一批车位</button>
        </section>
        <section v-if="game.state.recent.length" class="spaces history">
          <h2><PetIcon name="history" />最近结算</h2>
          <ol class="settlements"><li v-for="entry in game.state.recent" :key="entry.id">
            <span><b>{{ carName(entry.car) }}</b><small>{{ entry.ending === 'ticket' ? '被贴条' : '主动收车' }}</small></span>
            <strong>+{{ entry.paid }} 游园币</strong>
          </li></ol>
        </section>
      </div>
      <section class="showroom"><h2><PetIcon name="shop" />{{ game.state.owned.length ? '游园车行' : '免费选一辆初始车' }}</h2>
        <p class="muted">按实际停放时间计费，每次最多 8 小时。收车或被贴条时，收益进入车主钱包。</p>
        <div class="cars"><article v-for="car in showroom" :key="car.id">
          <img :src="art(car.id)" :alt="car.name" loading="lazy" width="320" height="188" />
          <div class="details"><h3>{{ car.name }}</h3><dl class="rates"><div><dt>每小时</dt><dd>{{ car.rate }} 币</dd></div><div><dt>单次最多</dt><dd>{{ car.rate * 8 }} 币</dd></div></dl>
            <button v-if="!game.state.owned.length" :disabled="locked" @click="game.submit({ action: 'starter', car: car.id })">免费领取</button>
            <span v-else-if="game.state.owned.includes(car.id)" class="owned"><PetIcon name="check" />已入库</span>
            <button v-else :disabled="locked || game.state.coins < car.price" @click="purchase = car">{{ car.price.toLocaleString() }} 游园币购买</button>
          </div>
        </article></div>
      </section>
    </template>
    <FpDialog :open="!!purchase" title="确认购车" @close="purchase = null">
      <div v-if="purchase" class="purchase-summary">
        <img :src="art(purchase.id)" alt="" width="80" height="80" />
        <div><strong>{{ purchase.name }}</strong><p>需支付 {{ purchase.price.toLocaleString() }} 游园币</p></div>
      </div>
      <template #footer>
        <div class="fp-ui trip-actions">
          <button type="button" class="fp-control" @click="purchase = null">取消</button>
          <button type="button" class="fp-control" data-tone="primary" :disabled="locked" @click="confirmPurchase">确认购买</button>
        </div>
      </template>
    </FpDialog>
    <FpDialog :open="!!game.challenge" title="停车验证" @close="game.challenge = null">
      <div ref="captchaEl" /><p v-if="captcha.error.value" role="alert">{{ captcha.error.value }}</p>
    </FpDialog>
  </main>
</template>

<style scoped src="./parking.css"></style>
