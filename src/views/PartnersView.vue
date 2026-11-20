<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { avatarThumbnail, fallbackAvatar } from '@/utils/avatar'
import { useRoute } from 'vue-router'
import PartnerActivity from '@/components/PartnerActivity.vue'
import FpDialog from '@/components/FpDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { usePartnersStore } from '@/stores/partners'
import { usePageSeo } from '@/composables/usePageSeo'
import { formatPartnerValue, type PartnerCommand } from '@/api/v3-partners'

usePageSeo(() => ({ title: '抢搭子', path: '/partners', robots: 'noindex' }))
const auth = useAuthStore(), game = usePartnersStore()
const confirm = ref<{ title: string; detail: string; button: string; cmd: PartnerCommand } | null>(null)
const route = useRoute()
const peer = computed(() => typeof route.query.peer === 'string' && /^[1-9][0-9]{0,18}$/.test(route.query.peer) ? route.query.peer : '')
const locked = computed(() => game.loading || game.busy || !!game.pending)
const canHire = computed(() => game.state?.joined && game.state.slots.some(s => !s.peer))
const unlockCost = computed(() => game.state?.slots.length === 1 ? 600 : 1600)
const mounted = ref(false)
watch([mounted, peer, () => auth.account?.oId, () => !!auth.accessToken], () => {
  confirm.value = null
  if (mounted.value && auth.isLoggedIn) void game.load('', peer.value)
}, { flush: 'post' })
function refresh() {
  if (!document.hidden && !game.busy && !game.loading) void game.load()
}
onMounted(() => { mounted.value = true; document.addEventListener('visibilitychange', refresh) })
onUnmounted(() => document.removeEventListener('visibilitychange', refresh))
function ask(title: string, detail: string, button: string, cmd: PartnerCommand) {
  confirm.value = { title, detail, button, cmd }
}
function accept() {
  if (confirm.value && !locked.value) void game.submit(confirm.value.cmd)
  confirm.value = null
}
</script>
<template>
  <main class="partners fp-page fp-page--wide fp-ui">
    <header class="mast">
      <div><RouterLink to="/games">游戏大厅</RouterLink><h1>抢搭子</h1></div>
      <dl v-if="game.state"><div v-if="game.state.displayValue"><dt>我的身价</dt><dd>{{ formatPartnerValue(game.state.displayValue) }}</dd></div><div><dt>游园币余额</dt><dd>{{ game.state.coins.toLocaleString() }}</dd></div>
        <div><dt>今日营业收入</dt><dd>{{ game.state.today }}</dd></div></dl>
    </header>
    <p v-if="game.error" role="alert">{{ game.error }} <button @click="game.load()">重试</button></p>
    <p v-else-if="!game.state" role="status">正在读取搭子…</p>
    <p v-if="game.message" role="status">{{ game.message }}
      <button v-if="game.pending" :disabled="game.busy" @click="game.run()">核对原操作</button></p>
    <div v-if="game.state" class="lobby">
      <div class="side">
      <section class="panel team">
        <header><h2>我的搭子</h2><button v-if="game.state.joined" :disabled="locked" @click="ask('退出搭子社？','现有搭班全部结束，每位邀请人收回 100 币。已购位置和今日使用时间会保留。','退出搭子社',{action:'leave',revision:game.state.revision})">退出搭子社</button></header>
        <template v-if="game.state.joined">
          <div class="host"><span>谁请了我</span><strong>{{ game.state.holderName || '暂时空闲' }}</strong>
            <small>{{ game.state.holderName ? '搭班收入 2 币/小时' : '名片已开放' }}</small></div>
          <ul class="slots"><li v-for="(slot,i) in game.state.slots" :key="i">
            <small class="seat-label">搭子位 {{ i+1 }}</small><strong>{{ slot.name || '空位' }}</strong>
            <span>{{ slot.peer ? slot.rate+' 币/小时 · ' : '' }}今日已赚 {{ slot.today }} 币</span>
            <small>今日剩余 {{ Math.ceil((28800000-slot.usedMs)/60000) }} 分钟</small>
            <button v-if="slot.peer" :disabled="locked" @click="ask('放手 '+slot.name+'？','营业收入自动结清，收回基础保证金 100 币。','放手 · 退 100 币',{action:'release',peer:slot.peer,revision:game.state.revision})">放手 · 退 100 币</button>
          </li></ul>
          <button class="unlock" v-if="game.state.slots.length<3" :disabled="locked || game.state.coins<unlockCost" @click="ask('解锁搭子位？','支付 '+unlockCost+' 游园币，永久增加一个搭子位，每天可独立营业 8 小时。','确认解锁',{action:'unlock',revision:game.state.revision})">解锁下一位 · {{ unlockCost }} 币</button>
        </template>
        <template v-else><p>加入后鱼友可以请你搭班。第一个搭子位免费，每个位置每天营业最多 8 小时。</p>
          <button class="primary" :disabled="locked" @click="game.submit({action:'join'})">加入搭子社</button></template>
      </section>
      <PartnerActivity class="history" :snapshot="game.state" />
      </div>
      <section class="panel market">
        <header><h2>{{ peer ? '鱼友名片' : '可以请的鱼友' }}</h2><RouterLink v-if="peer" to="/partners">全部鱼友</RouterLink><button :disabled="locked" @click="game.load()">刷新</button></header>
        <p v-if="!game.state.list.length">{{ peer ? '这位鱼友当前没有开放名片。' : '这一页还没有鱼友名片。' }}</p>
        <ul class="directory"><li v-for="player in game.state.list" :key="player.id">
          <div class="person">
            <RouterLink :to="'/member/'+encodeURIComponent(player.userName)" :data-user-card="player.userName">
              <img :src="avatarThumbnail(player.avatar,40)" alt="" width="40" height="40" loading="lazy" @error="fallbackAvatar"/>
              <span><strong>{{ player.name }}</strong><small v-if="player.following">已关注</small></span>
            </RouterLink>
          </div>
          <dl class="quote">
            <div v-if="player.displayValue"><dt>身价</dt> <dd>{{ formatPartnerValue(player.displayValue) }}</dd></div>
            <div><dt>营业时薪</dt><dd>{{ player.rate }} 币</dd></div>
          </dl>
          <button :disabled="locked || !canHire || player.mine || player.full || game.state.coins<player.price"
            @click="ask('请 '+player.name+' 搭班？','本次请人费用 '+player.price+' 币，每小时赚 '+player.rate+' 币。放手或对方退出时退 100 币。','确认 · '+player.price+' 币',{action:'hire',peer:player.id,revision:player.revision,rateVersion:player.rateVersion})">
            {{ player.mine ? '我的搭子' : player.full ? '已满价' : (player.price===100?'请 TA':'抢走')+' · '+player.price+' 币' }}
          </button>
        </li></ul>
        <footer v-if="game.cursor || game.state.next"><button v-if="game.cursor" :disabled="locked" @click="game.load('')">回第一页</button>
          <button v-if="game.state.next" :disabled="locked" @click="game.load(game.state.next)">下一页</button></footer>
      </section>
    </div>
    <FpDialog :open="!!confirm" :title="confirm?.title" @close="confirm=null">
      <p>{{ confirm?.detail }}</p><template #footer><button @click="confirm=null">取消</button>
        <button class="primary" :disabled="locked" @click="accept">{{ confirm?.button }}</button></template>
    </FpDialog>
  </main>
</template>
<style scoped>
.partners { display:grid; gap:16px; }
h1,h2,p,dl,dd,ul { margin:0; }
ul { padding:0; list-style:none; }
.mast,.panel { border-radius:var(--fp-panel-radius,12px); padding:clamp(16px,2vw,24px); }
.mast { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:20px; background:#21433c; color:white; }
.mast a,.mast dt { color:#d6e6de; font-size:13px; }
h1 { margin-top:4px; font-size:30px; }
h2 { font-size:18px; }
.mast dl { display:flex; flex-wrap:wrap; gap:12px 24px; }
.mast dl div { padding-inline-start:16px; border-inline-start:1px solid #ffffff40; }
.mast dd { margin-top:4px; font-size:clamp(18px,2vw,26px); font-weight:700; overflow-wrap:anywhere; }
dd,.slots { font-variant-numeric:tabular-nums; }
.lobby { display:grid; grid-template-columns:minmax(0,2fr) minmax(290px,1fr); gap:16px; align-items:start; }
.market { grid-column:1; grid-row:1; }
.side { grid-column:2; grid-row:1; display:grid; gap:16px; min-width:0; }
.panel { min-width:0; background:var(--fp-card); border:1px solid var(--fp-border); }
.panel header,footer { display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
.panel header { border-bottom:1px solid var(--fp-border); padding-bottom:12px; margin-bottom:14px; }
.panel header h2 { margin-inline-end:auto; }
.panel p,small,.slots span,.quote dt,.host span { color:var(--fp-muted); }
.host { display:flex; flex-wrap:wrap; align-items:baseline; gap:6px 10px; font-size:14px; }
.host strong { margin-inline-start:auto; }
.slots { display:grid; gap:8px; margin:14px 0 10px; }
.slots li { display:grid; grid-template-columns:1fr auto; align-items:baseline; gap:5px 10px; padding:12px; background:var(--fp-elevated); border-radius:8px; }
.slots strong { text-align:end; }
.slots span,.slots small { font-size:12px; }
.slots button { grid-column:1 / -1; }
strong,.quote dd { overflow-wrap:anywhere; }
.directory li { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) auto; align-items:center; gap:12px; padding:12px 0; }
.directory li + li { border-top:1px solid var(--fp-border); }
.person a { display:flex; align-items:center; gap:10px; color:inherit; }
.person small { display:block; font-size:12px; }
.person img { flex:none; border-radius:10px; object-fit:cover; }
.quote { display:flex; flex-wrap:wrap; gap:6px 18px; }
.quote dt { font-size:12px; }
.quote dd { font-weight:600; font-size:14px; }
button { justify-self:start; border:1px solid var(--fp-border); background:var(--fp-card); color:var(--fp-text); border-radius:7px; padding:7px 12px; font:inherit; cursor:pointer; }
button:disabled { opacity:.56; cursor:default; }
button:enabled:hover { border-color:var(--fp-primary); }
button.primary,.directory button:enabled { color:var(--fp-primary-ink); background:var(--fp-primary-soft); }
.unlock { width:100%; border-style:dashed; }
.panel p + button { margin-top:12px; }
footer { justify-content:flex-end; margin-top:12px; }
@media(max-width:820px) {
  .lobby { grid-template-columns:minmax(0,1fr); }
  .side { display:contents; }
  .team,.market,.history { grid-column:1; }
  .team { grid-row:1; }
  .market { grid-row:2; }
  .history { grid-row:3; }
}
@media(max-width:560px) {
  .mast { display:grid; gap:14px; }
  .mast dl { display:grid; grid-template-columns:repeat(auto-fit,minmax(68px,1fr)); gap:8px; }
  .mast dl div { padding-inline-start:8px; }
  .mast dl div:first-child { padding:0; border:0; }
  .directory li { grid-template-columns:minmax(0,1fr) auto; gap:6px 10px; }
  .directory .quote { grid-column:1; margin-inline-start:50px; }
  .quote div { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px; }
  .directory button { grid-column:2; grid-row:span 2 / 3; }
  button { min-height:44px; }
}
</style>
