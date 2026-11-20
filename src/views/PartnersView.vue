<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { avatarUrl, avatarThumbnail, fallbackAvatar } from '@/utils/avatar'
import { useRoute } from 'vue-router'
import PartnerActivity from '@/components/PartnerActivity.vue'
import PetIcon from '@/components/pets/PetIcon.vue'
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
      <div><RouterLink to="/games">游戏 / 鱼游</RouterLink><h1>抢搭子</h1></div>
      <div v-if="game.state" class="wallet"><PetIcon name="coin" /><strong>{{ game.state.coins.toLocaleString() }}</strong> 游园币</div>
    </header>
    <p v-if="game.error" role="alert">{{ game.error }} <button @click="game.load()">重试</button></p>
    <p v-else-if="!game.state" role="status">正在读取搭子…</p>
    <p v-if="game.message" role="status">{{ game.message }}
      <button v-if="game.pending" :disabled="game.busy" @click="game.run()">核对原操作</button></p>
    <div v-if="game.state" class="lobby">
      <section class="panel identity">
        <header><h2><PetIcon name="home" />我的名片</h2><button class="quiet" v-if="game.state.joined" :disabled="locked" @click="ask('退出搭子社？','现有搭班全部结束，每位邀请人收回 100 币。已购位置和今日使用时间会保留。','退出搭子社',{action:'leave',revision:game.state.revision})">退出搭子社</button></header>
        <RouterLink v-if="auth.account?.userName" class="owner" :to="'/member/'+encodeURIComponent(auth.account.userName)" :data-user-card="auth.account.userName">
          <img :src="avatarThumbnail(avatarUrl(auth.account),48)" width="48" height="48" alt="" @error="fallbackAvatar"/>
          <span><strong>{{ auth.account.userNickname || auth.account.userName }}</strong><small>@{{ auth.account.userName }}</small></span>
        </RouterLink>
        <dl class="account-stats">
          <div v-if="game.state.displayValue"><dt>我的身价</dt><dd>{{ formatPartnerValue(game.state.displayValue) }}</dd></div>
          <div><dt>今日营业收入</dt><dd>{{ game.state.today }} <small>币</small></dd></div>
        </dl>
        <div v-if="game.state.joined" class="host"><span>谁请了我</span><strong>{{ game.state.holderName || '暂时空闲' }}</strong>
          <small v-if="game.state.holderName">2 币/小时</small></div>
      </section>
      <section class="panel team">
        <header><h2><PetIcon name="work" />我的搭子</h2><small v-if="game.state.joined">{{ game.state.slots.filter(slot => slot.peer).length }} / {{ game.state.slots.length }} 位搭班中</small></header>
        <template v-if="game.state.joined">
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

      <section class="panel market">
        <header><h2><PetIcon name="outing" />{{ peer ? '鱼友名片' : '可以请的鱼友' }}</h2><RouterLink v-if="peer" to="/partners">全部鱼友</RouterLink><button :disabled="locked" @click="game.load()">刷新</button></header>
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
      <PartnerActivity class="history" :snapshot="game.state" />
    </div>
    <FpDialog :open="!!confirm" :title="confirm?.title" @close="confirm=null">
      <p>{{ confirm?.detail }}</p><template #footer><button @click="confirm=null">取消</button>
        <button class="primary" :disabled="locked" @click="accept">{{ confirm?.button }}</button></template>
    </FpDialog>
  </main>
</template>
<style scoped>
.partners,.lobby,.slots,.directory { display:grid; gap:16px; }
h1,h2,p,dl,dd,ul { margin:0; }
ul { padding:0; list-style:none; }
.mast,.wallet,.panel header,h2,.host,.person a,footer { display:flex; align-items:center; gap:8px; }
.mast,.panel header { justify-content:space-between; }
.mast { padding:4px 2px; }
.mast a,.panel small,dt,.host span { color:var(--fp-muted); font-size:13px; }
h1 { margin-top:4px; font-size:clamp(26px,3vw,34px); }
.wallet { padding:8px 14px; border-radius:24px; background:var(--fp-primary-soft); color:var(--fp-primary-ink); font-size:13px; }
.wallet strong { font-size:19px; }
.lobby { grid-template-columns:minmax(0,3fr) minmax(0,2fr); align-items:start; }
.panel { background:var(--fp-card); border:1px solid var(--fp-border); border-radius:var(--fp-panel-radius,12px); padding:clamp(16px,2vw,24px); min-width:0; }
.panel header { flex-wrap:wrap; margin-bottom:16px; }
.panel header h2 { margin-inline-end:auto; font-size:18px; }
h2 svg { color:var(--fp-primary-ink); }
.identity,.team { align-self:stretch; }
.identity { display:flex; flex-direction:column; }
.owner { display:flex; gap:12px; align-items:center; align-self:start; color:inherit; margin:2px 0 18px; }
.owner img { border-radius:12px; object-fit:cover; }
.owner small { display:block; }
.account-stats { display:flex; flex-wrap:wrap; gap:18px 38px; margin-block:auto; }
.account-stats dd { font-size:clamp(24px,2.8vw,36px); font-weight:700; line-height:1.3; }
.account-stats small { font-weight:400; }
.host { margin-top:16px; border-top:1px solid var(--fp-border); padding-top:12px; flex-wrap:wrap; }
.host small { margin-inline-start:auto; }
.slots { gap:8px; }
.slots li { display:grid; grid-template-columns:1fr auto; gap:5px 10px; padding:10px 12px; border-inline-start:3px solid var(--fp-border); background:var(--fp-elevated); border-radius:6px; }
.slots li:has(button) { border-inline-start-color:var(--fp-primary); }
.slots strong { text-align:end; }
.slots span,.slots small { font-size:12px; color:var(--fp-muted); }
.slots button { justify-self:start; }
button { border:1px solid var(--fp-border); background:var(--fp-card); color:var(--fp-text); border-radius:7px; padding:6px 11px; font:inherit; cursor:pointer; }
button:disabled { opacity:.55; cursor:default; }
button:enabled:hover { border-color:var(--fp-primary); }
button.primary,.directory button:enabled { color:var(--fp-primary-ink); background:var(--fp-primary-soft); }
button.quiet { border-color:transparent; color:var(--fp-muted); font-size:13px; }
.unlock,.panel p + button { margin-top:12px; }
.directory { grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr)); gap:10px; }
.directory li { min-width:0; display:flex; flex-direction:column; gap:12px; padding:14px; border-radius:10px; border:1px solid var(--fp-border); }
.person a { color:inherit; }
.person img { object-fit:cover; border-radius:12px; }
.person small { display:block; }
strong,dd { overflow-wrap:anywhere; }
.quote { display:flex; flex-wrap:wrap; gap:8px 20px; margin-top:auto; }
.quote dd { font-weight:600; font-size:14px; }
dd,.wallet { font-variant-numeric:tabular-nums; }
footer { justify-content:flex-end; margin-top:12px; }
@media(max-width:800px) {
  .lobby { grid-template-columns:minmax(0,1fr); }
}
@media(max-width:520px) {
  .partners,.lobby { gap:12px; }
  .directory { grid-template-columns:minmax(0,1fr); }
  .directory li { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:8px; }
  .quote { grid-row:2; grid-column:1 / -1; padding-top:8px; border-top:1px solid var(--fp-border); }
  .quote div { display:flex; align-items:baseline; gap:6px; }
  .directory button { grid-column:2; grid-row:1; }
  button { min-height:44px; }
}
</style>
