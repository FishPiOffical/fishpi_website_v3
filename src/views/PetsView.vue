<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getAuthContextVersion } from '@/api/http'
import { normalizePetName, petNameLength, type PetSpeciesId } from '@/api/v3-pets'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'
import { usePetDisplayStore } from '@/stores/petDisplay'
import { usePetActivityHistoryStore } from '@/stores/petActivityHistory'
import PetActions from '@/components/pets/PetActions.vue'
import PetActivities from '@/components/pets/PetActivities.vue'
import PetActivityHistory from '@/components/pets/PetActivityHistory.vue'
import PetShop from '@/components/pets/PetShop.vue'
import PetWorkshop from '@/components/pets/PetWorkshop.vue'
import PetStories from '@/components/pets/PetStories.vue'
import PetReadoption from '@/components/pets/PetReadoption.vue'
import PetFeedback from '@/components/pets/PetFeedback.vue'
import PetIcon from '@/components/pets/PetIcon.vue'
import PetAnimation from '@/components/pets/PetAnimation.vue'
import { usePetAnimationState } from '@/components/pets/usePetAnimationState'
import PetGrowthSummary from '@/components/pets/PetGrowthSummary.vue'
import PetHomeNavigation from '@/components/pets/PetHomeNavigation.vue'
import PetHomeGuide from '@/components/pets/PetHomeGuide.vue'
import type { PetHomeSection, PetHomeTarget } from '@/components/pets/petNavigation'
import { usePetClock } from '@/components/pets/usePetClock'
import { petActivityStatus } from '@/components/pets/petActivityStatus'

usePageSeo(() => ({ title: '宠物家园', path: '/pets', description: '领养你的摸鱼伙伴，照顾它，一起慢慢长大。', robots: 'noindex,follow' }))
const auth = useAuthStore(), pets = usePetsStore(), display = usePetDisplayStore()
const history = usePetActivityHistoryStore()
const section = ref<PetHomeSection>('care')
const page = ref<HTMLElement | null>(null)
const activities = ref<InstanceType<typeof PetActivities> | null>(null)
const shop = ref<InstanceType<typeof PetShop> | null>(null)
const rewards = computed(() => pets.state?.stories.filter(story => story.status === 'claimable').length ?? 0)
let navigationVersion = 0
const mounted = ref(false), selected = ref<PetSpeciesId>('hexiaotun'), name = ref(''), nameError = ref('')
const editingName = ref(false), renameDraft = ref('')
const { now } = usePetClock()
const animationActive = computed(() => mounted.value && section.value === 'care' && !!pets.pet)
const animation = usePetAnimationState(now, animationActive)
const owner = computed(() => `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}`)
const loggedIn = computed(() => mounted.value && auth.isLoggedIn)
const choices = [
  { id: 'momota', name: '摸摸獭' }, { id: 'hexiaotun', name: '荷小豚' },
  { id: 'yubingmiao', name: '鱼饼喵' }, { id: 'paixiaoyu', name: '派小鱼' },
] as const
const selectedSpecies = computed(() => pets.catalog?.species.find(species => species.id === selected.value))
const speciesName = computed(() => pets.catalog?.species.find(species => species.id === pets.pet?.speciesId)?.name ?? choices.find(species => species.id === pets.pet?.speciesId)?.name)
const locked = computed(() => pets.busy || !!pets.pending || pets.refreshNeeded || pets.loading)
const catalogErrorText = computed(() => /JSON|HTTP|SQL|fetch|network|token|stack|接口|数据格式/i.test(pets.catalogError) ? '宠物目录暂时不可用，请稍后重试。' : pets.catalogError)
const activityText = computed(() => petActivityStatus(pets.pet?.activity ?? null, now.value))
const resting = computed(() => pets.pet?.activity?.kind === 'rest')
const stats = computed(() => pets.pet ? [
  { key: 'hunger', label: '饱食', icon: 'feed' as const, value: pets.pet.hunger },
  { key: 'water', label: '水分', icon: 'water' as const, value: pets.pet.water },
  { key: 'mood', label: '心情', icon: 'pet' as const, value: pets.pet.mood },
  { key: 'energy', label: '精力', icon: 'wake' as const, value: pets.pet.energy },
] : [])

function choose(id: PetSpeciesId) { selected.value = id; nameError.value = '' }
async function adopt() {
  if (!selectedSpecies.value || locked.value) return
  nameError.value = ''
  try {
    const value = normalizePetName(name.value || selectedSpecies.value.name)
    if (await pets.adopt(selected.value, value)) name.value = ''
  } catch (error) { nameError.value = error instanceof Error ? error.message : '请检查宠物名字' }
}
function startRename() {
  renameDraft.value = pets.pet?.name ?? ''
  nameError.value = ''
  editingName.value = true
}
async function rename() {
  if (locked.value) return
  nameError.value = ''
  try {
    if (await pets.rename(normalizePetName(renameDraft.value))) editingName.value = false
  } catch (error) { nameError.value = error instanceof Error ? error.message : '请检查宠物名字' }
}
function load() { if (mounted.value && auth.isLoggedIn && !document.hidden) void pets.ensureLoaded() }
async function navigate(target: PetHomeTarget, focusPanel = true) {
  if (!loggedIn.value || !pets.pet) return
  const version = ++navigationVersion, context = owner.value, petId = pets.pet.id
  section.value = target.section
  // 隐藏的日志面板不能因聚焦或其它照顾操作继续读取私人记录。
  if (target.section !== 'history') history.close()
  await nextTick()
  const valid = () => version === navigationVersion && context === owner.value && petId === pets.pet?.id && !!page.value
  if (!valid()) return
  if (target.section === 'history' && !history.opened) void history.open()
  if (!focusPanel) return
  const panel = page.value?.querySelector<HTMLElement>(`[data-pet-panel="${target.section}"]`)
  let focused = false
  if (target.section === 'activities') focused = await activities.value?.focusEntry(target.kind, target.entryId, valid) ?? false
  else if (target.section === 'shop') focused = await shop.value?.focusItem(target.itemId, valid) ?? false
  if (!focused && valid()) {
    const destination = target.section === 'care' && target.anchor === 'supplies'
      ? page.value?.querySelector<HTMLElement>('#pet-daily-supplies') : panel
    destination?.focus({ preventScroll: true })
    destination?.scrollIntoView?.({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
}
function resetNavigation() {
  navigationVersion++
  section.value = 'care'
  history.close()
}
watch(owner, () => {
  resetNavigation()
  editingName.value = false
  renameDraft.value = ''; name.value = ''; nameError.value = ''
  load()
})
watch(() => pets.pet?.id, resetNavigation)
onBeforeUnmount(() => { navigationVersion++; history.close() })
onMounted(() => { mounted.value = true; display.restore(); load() })
</script>

<template>
  <div ref="page" class="pets-page fp-page fp-page--wide fp-ui">
    <header class="page-heading">
      <div><RouterLink to="/games" class="back-link">游戏 / 鱼游</RouterLink><h1>宠物家园</h1></div>
      <div v-if="loggedIn && pets.state" class="pet-wallet" title="仅用于宠物家园"><PetIcon name="coin" /><strong>{{ pets.coins?.toLocaleString() }}</strong><span>宠物币</span></div>
    </header>

    <section v-if="!loggedIn" class="guest-panel pet-panel">
      <div class="guest-pets" aria-hidden="true"><img v-for="choice in choices" :key="choice.id" :src="`/images/pets/${choice.id}.webp`" width="144" height="144" alt="" /></div>
      <h2>领养一位摸鱼伙伴</h2><p>四种宠物，选择一只带回家。喂食、陪伴，记录一起长大的日常。</p>
      <RouterLink class="pet-primary" :to="{ path: '/login', query: { redirect: '/pets' } }">登录后领养</RouterLink>
      <span class="guest-note">每个账号可以免费领养一只</span>
    </section>
    <template v-else>
      <PetFeedback />
      <div v-if="catalogErrorText" class="catalog-error" role="alert"><span>{{ catalogErrorText }}</span><button type="button" class="icon-button" :disabled="pets.catalogLoading" aria-label="重新读取宠物目录" title="重新读取目录" @click="pets.reloadCatalog()"><PetIcon name="refresh" /></button></div>
      <div v-if="!pets.state && pets.loading" class="pet-panel loading-state" role="status"><span class="loading-dot" />正在准备宠物家园…</div>

      <section v-if="pets.state && !pets.pet" class="adoption pet-panel" aria-labelledby="adoption-title">
        <header class="section-heading"><div><h2 id="adoption-title">从一次相遇开始</h2><p>选一个合眼缘的伙伴，名字以后也能修改。</p></div><span class="free-label">免费领养</span></header>
        <fieldset v-if="pets.catalog" class="species-options"><legend class="sr-only">选择想领养的宠物</legend>
          <label v-for="species in pets.catalog.species" :key="species.id" class="species-option" :class="{ selected: selected === species.id }">
            <input type="radio" name="pet-species" :value="species.id" :checked="selected === species.id" :disabled="locked" @change="choose(species.id)" />
            <span class="selection-check" aria-hidden="true"><PetIcon v-if="selected === species.id" name="check" /></span>
            <img :src="`/images/pets/${species.id}.webp`" :alt="species.name" width="180" height="180" />
            <strong>{{ species.name }}</strong><span class="species-description">{{ species.description }}</span>
          </label>
        </fieldset>
        <div v-else-if="pets.catalogLoading" class="loading-state" role="status">正在认识新伙伴…</div>
        <form v-if="selectedSpecies" class="adoption-form" @submit.prevent="adopt">
          <div class="name-field"><label for="pet-adoption-name">给它起个名字</label><div class="name-input"><input id="pet-adoption-name" v-model="name" :placeholder="selectedSpecies.name" autocomplete="off" :disabled="locked" aria-describedby="adoption-name-hint" /><span>{{ petNameLength(name || selectedSpecies.name) }} / {{ pets.catalog?.rules.maxNameLength }}</span></div><p id="adoption-name-hint">留空会使用「{{ selectedSpecies.name }}」。每个账号只能领养一只。</p></div>
          <button type="submit" class="pet-primary" :disabled="locked || petNameLength(name || selectedSpecies.name) > (pets.catalog?.rules.maxNameLength ?? 12)">{{ pets.busy ? '正在领养…' : `带${selectedSpecies.name}回家` }}</button>
          <p v-if="nameError" class="form-error" role="alert">{{ nameError }}</p>
        </form>
        <p v-if="pets.catalog" class="adoption-supply"><PetIcon name="gift" />入住时获得 {{ pets.catalog.rules.initialCoins }} 宠物币和 {{ pets.catalog.rules.initialFood }} 份口粮。</p>
      </section>

      <template v-if="pets.pet && pets.state">
        <PetHomeGuide @navigate="navigate" />
        <PetHomeNavigation :selected="section" :rewards="rewards" @select="navigate({ section: $event }, false)" />
        <div v-show="section === 'care'" id="pet-home-panel-care" class="pet-home-panel" data-pet-panel="care" role="tabpanel" aria-labelledby="pet-home-tab-care" tabindex="-1">
        <section class="pet-home pet-panel" aria-label="我的宠物">
          <div class="companion">
            <header class="companion-heading"><span class="species-label">{{ speciesName }}</span><span class="level-label">Lv. {{ pets.pet.level }}</span></header>
            <div class="pet-scene" :class="{ resting }"><div class="scene-halo" aria-hidden="true" /><PetAnimation :key="pets.pet.id" :species="pets.pet.speciesId" :alt="pets.pet.name" :action="animation.action.value" :loop="animation.loop.value" :playback-key="animation.playbackKey.value" :active="animationActive" @ended="animation.end" /><span v-if="resting" class="sleep-mark" aria-hidden="true">Z z</span><span v-else-if="pets.pet.activity" class="activity-mark" aria-hidden="true"><PetIcon :name="pets.pet.activity.kind" /></span></div>
            <div v-if="!editingName" class="pet-name"><h2>{{ pets.pet.name }}</h2><button type="button" class="icon-button" :disabled="locked" aria-label="修改宠物名字" title="修改名字" @click="startRename"><PetIcon name="edit" /></button></div>
            <form v-else class="rename-form" @submit.prevent="rename"><label class="sr-only" for="pet-name">宠物名字</label><input id="pet-name" v-model="renameDraft" :disabled="locked" autocomplete="off" autofocus /><button type="submit" class="icon-button" :disabled="locked" aria-label="保存宠物名字" title="保存名字"><PetIcon name="check" /></button><button type="button" class="icon-button" :disabled="pets.busy" aria-label="取消修改名字" title="取消" @click="editingName = false"><PetIcon name="close" /></button></form>
            <p v-if="editingName" class="rename-count">{{ petNameLength(renameDraft) }} / {{ pets.catalog?.rules.maxNameLength ?? 12 }}</p>
            <p v-if="nameError" class="form-error" role="alert">{{ nameError }}</p>
            <p class="pet-status"><span :class="{ sleeping: resting }" />{{ activityText }}</p>
            <PetGrowthSummary />
          </div>
          <div class="care-panel">
            <header class="care-heading"><h2>今天也要好好照顾它</h2><button type="button" class="icon-button" :disabled="pets.loading || pets.busy" aria-label="刷新宠物状态" title="刷新状态" @click="pets.refresh()"><PetIcon name="refresh" /></button></header>
            <div class="pet-stats"><div v-for="stat in stats" :key="stat.key" class="pet-stat" :class="[stat.key, { low: stat.value < 25 }]"><div><span><PetIcon :name="stat.icon" />{{ stat.label }}</span><strong>{{ stat.value }}<small> / 100</small></strong></div><div class="stat-track" role="progressbar" :aria-label="stat.label" :aria-valuenow="stat.value" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: `${stat.value}%` }" /></div></div></div>
            <PetActions />
            <p class="care-note">{{ resting ? '休息时暂停其他互动，想提前见面也可以唤醒它。' : pets.pet.activity ? '这次活动结束并领取成果后，就可以继续照顾它了。' : '不在身边时也会慢慢消耗状态，休息可以恢复精力。' }}</p>
            <div class="daily-growth"><span>今日照顾成长</span><strong>{{ pets.pet.growthToday.used }} / {{ pets.pet.growthToday.limit }} 次</strong></div>
            <p v-if="pets.catalog?.growthRules" class="daily-growth-note">每日前 {{ pets.pet.growthToday.limit }} 次成功喂食、饮水、抚摸或玩耍，获得 {{ pets.catalog.growthRules.careExperience }} 经验及至多 {{ pets.catalog.growthRules.careFriendship }} 亲密度。之后仍可照顾宠物。</p>
          </div>
        </section>

        <div id="pet-daily-supplies" class="daily-supplies" tabindex="-1">
          <section class="supply-panel pet-panel" aria-labelledby="supply-title"><div class="supply-icon"><PetIcon name="gift" /></div><div class="supply-copy"><h2 id="supply-title">每日补给</h2><p>{{ pets.state.dailySupply.coins }} 宠物币 <span>＋</span> {{ pets.state.dailySupply.food }} 份口粮</p></div><button type="button" :class="pets.state.dailySupply.claimed ? 'pet-secondary' : 'pet-primary'" :disabled="locked || pets.state.dailySupply.claimed" @click="pets.claimSupply()">{{ pets.state.dailySupply.claimed ? '今日已领取' : '领取补给' }}</button></section>
          <p class="income-summary"><PetIcon name="coin" /><span>今日工作已赚 <strong>{{ pets.state.income.earned }}</strong> 币，还可赚 <strong>{{ pets.state.income.remaining }}</strong> 币。<span>每日补给单独计算，消费不会恢复工作额度。</span></span></p>
        </div>
        <section class="desktop-settings" aria-label="桌宠显示设置"><div><h2>让它陪你逛社区</h2><p>拖动桌宠可调整位置，收起后仍能随时找到它。</p></div><div class="desktop-buttons"><button type="button" class="pet-secondary" @click="display.visible ? display.hide() : display.show()">{{ display.visible ? '隐藏桌宠' : '显示桌宠' }}</button><button type="button" class="text-button" @click="display.resetPosition()">恢复默认位置</button></div></section>
        <PetReadoption />
        </div>
        <!-- 分区保留组件实例，切换时不丢失购买数量、筛选与未确认操作。 -->
        <div v-show="section === 'activities'" id="pet-home-panel-activities" class="pet-home-panel" data-pet-panel="activities" role="tabpanel" aria-labelledby="pet-home-tab-activities" tabindex="-1"><PetActivities ref="activities" /></div>
        <div v-show="section === 'stories'" id="pet-home-panel-stories" class="pet-home-panel" data-pet-panel="stories" role="tabpanel" aria-labelledby="pet-home-tab-stories" tabindex="-1"><PetStories /></div>
        <div v-show="section === 'shop'" id="pet-home-panel-shop" class="pet-home-panel" data-pet-panel="shop" role="tabpanel" aria-labelledby="pet-home-tab-shop" tabindex="-1"><PetShop ref="shop" /></div>
        <div v-show="section === 'workshop'" id="pet-home-panel-workshop" class="pet-home-panel" data-pet-panel="workshop" role="tabpanel" aria-labelledby="pet-home-tab-workshop" tabindex="-1"><PetWorkshop @navigate="navigate" /></div>
        <div v-show="section === 'history'" id="pet-home-panel-history" class="pet-home-panel" data-pet-panel="history" role="tabpanel" aria-labelledby="pet-home-tab-history" tabindex="-1"><PetActivityHistory /></div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.pets-page { max-width: 1180px; margin-inline: auto; color: var(--fp-text); }
.pet-home-panel, #pet-daily-supplies { scroll-margin-top: calc(var(--fp-nav-h, 58px) + 16px); }
.pet-home-panel:focus-visible { outline: 2px solid var(--fp-primary-ink, var(--fp-primary)); outline-offset: 4px; border-radius: 12px; }
.pet-home-panel > :deep(.pet-activities), .pet-home-panel > :deep(.pet-stories), .pet-home-panel > :deep(.pet-workshop), .pet-home-panel > :deep(.pet-shop), .pet-home-panel > :deep(.pet-history) { margin-top: 0; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.page-heading h1 { margin: 5px 0 0; color: var(--fp-title); font-size: 28px; letter-spacing: -.5px; }
.back-link { color: var(--fp-muted); font-size: 13px; }
.pet-wallet { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border: 1px solid var(--fp-border); border-radius: 12px; background: var(--fp-card); white-space: nowrap; }
.pet-wallet svg { color: var(--fp-accent); }.pet-wallet strong { font-size: 20px; font-variant-numeric: tabular-nums; }.pet-wallet span { color: var(--fp-muted); font-size: 12px; }
.pet-panel { border: 1px solid var(--fp-border); border-radius: var(--fp-panel-radius, 14px); background: var(--fp-card); overflow: hidden; }
.pet-primary, .pet-secondary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; padding: 10px 18px; border: 1px solid transparent; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: transform .16s, background .16s; text-decoration: none; white-space: nowrap; }
.pet-primary { background: var(--fp-primary-fill, var(--fp-primary)); color: #fff; }.pet-secondary { background: var(--fp-card); color: var(--fp-text); border-color: var(--fp-border); }
.pet-primary:not(:disabled):hover, .pet-secondary:not(:disabled):hover { transform: translateY(-1px); filter: brightness(.97); text-decoration: none; }
button:disabled { opacity: .5; cursor: default; }button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--fp-primary-ink, var(--fp-primary)); outline-offset: 3px; }
.icon-button { display: inline-grid; place-items: center; width: 34px; height: 34px; padding: 0; flex: none; border: 0; border-radius: 8px; color: var(--fp-muted); background: transparent; cursor: pointer; }.icon-button:not(:disabled):hover { color: var(--fp-primary); background: var(--fp-hover); }.icon-button svg { width: 17px; height: 17px; }
.pets-page > :deep(.pet-feedback), .catalog-error { margin-bottom: 16px; }.catalog-error { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--fp-muted); }
.loading-state { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 64px 24px; color: var(--fp-muted); }.loading-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--fp-primary); }
.guest-panel { text-align: center; padding: 48px 24px; }.guest-pets { display: flex; justify-content: center; margin-bottom: 24px; }.guest-pets img { width: min(21%, 144px); height: auto; object-fit: contain; }.guest-panel h2 { margin: 0 0 12px; color: var(--fp-title); font-size: 26px; }.guest-panel p { color: var(--fp-muted); line-height: 1.8; margin-bottom: 24px; }.guest-note { display: block; margin-top: 16px; color: var(--fp-muted); font-size: 12px; }
.adoption { padding: 28px; }.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }.section-heading h2 { margin: 0 0 8px; font-size: 22px; color: var(--fp-title); }.section-heading p { margin: 0; color: var(--fp-muted); font-size: 14px; }.free-label { padding: 6px 10px; border-radius: 7px; color: var(--fp-primary); background: var(--fp-primary-soft); font-size: 12px; white-space: nowrap; }
.species-options { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; padding: 0; margin: 0; border: 0; }.species-option { position: relative; display: flex; flex-direction: column; align-items: center; padding: 16px 12px; border: 1px solid var(--fp-border); border-radius: 12px; background: var(--fp-card); cursor: pointer; transition: border-color .16s, background .16s; }.species-option.selected { border-color: var(--fp-primary); background: var(--fp-primary-soft); }.species-option:has(:focus-visible) { outline: 2px solid var(--fp-primary-ink, var(--fp-primary)); outline-offset: 3px; }.species-option input { position: absolute; width: 1px; height: 1px; opacity: 0; }.species-option img { width: 100%; height: auto; max-width: 180px; aspect-ratio: 1; object-fit: contain; transition: transform .2s; }.species-option:hover img { transform: translateY(-3px); }.species-option strong { margin-top: 8px; font-size: 17px; color: var(--fp-title); }.species-description { margin-top: 8px; color: var(--fp-muted); font-size: 12px; line-height: 1.7; text-align: center; }.selection-check { position: absolute; right: 10px; top: 10px; display: grid; place-items: center; width: 20px; height: 20px; color: var(--fp-primary); }.selection-check svg { width: 18px; height: 18px; }
.adoption-form { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; padding-top: 28px; }.name-field { flex: 1; min-width: 200px; }.name-field > label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600; }.name-input { display: flex; align-items: center; border: 1px solid var(--fp-border); border-radius: 8px; max-width: 460px; background: var(--fp-card); }.name-input input { width: 100%; min-width: 0; padding: 12px; border: 0; border-radius: inherit; background: transparent; color: var(--fp-text); font: inherit; }.name-input > span { flex: none; padding-right: 12px; color: var(--fp-muted); font-size: 12px; }.name-field p { margin: 8px 0 0; font-size: 12px; color: var(--fp-muted); }.form-error { width: 100%; color: var(--fp-danger, #b34137); font-size: 13px; margin: 0; }.adoption-supply { display: flex; align-items: center; gap: 8px; margin: 24px 0 0; padding-top: 20px; border-top: 1px solid var(--fp-border); font-size: 12px; color: var(--fp-muted); }.adoption-supply svg { width: 17px; height: 17px; }
.pet-home { display: grid; grid-template-columns: minmax(260px, .9fr) minmax(0, 1.35fr); }.companion { padding: 24px; background: color-mix(in srgb, var(--fp-primary) 3%, var(--fp-card)); text-align: center; }.companion-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.species-label { color: var(--fp-muted); font-size: 13px; }.level-label { color: var(--fp-primary-ink, var(--fp-primary)); background: var(--fp-card); border: 1px solid var(--fp-border); border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 700; }
.pet-scene { position: relative; display: grid; place-items: center; max-width: 320px; margin: 12px auto 8px; isolation: isolate; }.pet-scene .pet-animation { width: min(100%, 256px); height: auto; object-fit: contain; z-index: 1; }.scene-halo { position: absolute; width: 75%; aspect-ratio: 1; border-radius: 50%; background: color-mix(in srgb, var(--fp-primary) 7%, var(--fp-card)); z-index: 0; }.pet-scene::after { content: ''; position: absolute; bottom: 2%; width: 65%; height: 12px; border-radius: 50%; background: color-mix(in srgb, var(--fp-primary) 8%, transparent); }.sleep-mark { position: absolute; right: 12%; top: 15%; color: var(--fp-muted); font-weight: 700; letter-spacing: 5px; font-size: 18px; }
.pet-name { display: flex; align-items: center; justify-content: center; gap: 3px; }.pet-name h2 { margin: 0; font-size: 24px; color: var(--fp-title); overflow-wrap: anywhere; }.pet-name button { margin-right: -34px; }.pet-status { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 8px 0 18px; font-size: 12px; color: var(--fp-muted); }.pet-status > span { width: 6px; height: 6px; border-radius: 50%; background: var(--fp-primary); }.pet-status > span.sleeping { background: #8392bb; }.rename-form { display: flex; align-items: center; gap: 4px; }.rename-form input { width: 100%; min-width: 0; border: 1px solid var(--fp-border); border-radius: 8px; padding: 8px; color: var(--fp-text); background: var(--fp-card); font: inherit; }.rename-count { margin: 6px 0; color: var(--fp-muted); font-size: 11px; }
.care-panel { padding: 28px; border-left: 1px solid var(--fp-border); }.care-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }.care-heading h2 { margin: 0; font-size: 18px; color: var(--fp-title); }.pet-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }.pet-stat > div:first-child { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }.pet-stat > div:first-child > span { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; }.pet-stat svg { width: 16px; height: 16px; color: var(--fp-muted); }.pet-stat strong { font-size: 15px; font-variant-numeric: tabular-nums; }.pet-stat small { color: var(--fp-muted); font-size: 11px; font-weight: 400; }.stat-track { height: 6px; background: var(--fp-hover); border-radius: 5px; overflow: hidden; }.stat-track > span { display: block; height: 100%; border-radius: inherit; background: #88a968; transition: width .3s; }.water .stat-track > span { background: #6b9bb4; }.mood .stat-track > span { background: #d29b91; }.energy .stat-track > span { background: #c5a35e; }.low strong { color: var(--fp-danger, #bb4038); }.care-note { color: var(--fp-muted); font-size: 12px; line-height: 1.7; margin: 16px 0 24px; }.daily-growth { display: flex; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid var(--fp-border); color: var(--fp-muted); font-size: 12px; }.daily-growth strong { color: var(--fp-text); font-variant-numeric: tabular-nums; font-weight: 500; }
.daily-growth-note { margin: 8px 0 0; color: var(--fp-muted); font-size: 11px; line-height: 1.7; }
.income-summary { display: flex; align-items: flex-start; gap: 8px; margin: -4px 4px 0; color: var(--fp-muted); font-size: 12px; line-height: 1.8; }.income-summary > svg { width: 16px; height: 16px; margin-top: 3px; }.income-summary strong { color: var(--fp-text); font-variant-numeric: tabular-nums; }.income-summary > span > span { display: block; font-size: 11px; }
.daily-supplies { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 16px; }.supply-panel { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 20px; }.supply-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; color: var(--fp-primary); background: var(--fp-primary-soft); flex: none; }.supply-copy { flex: 1; }.supply-copy h2 { margin: 0; color: var(--fp-title); font-size: 15px; }.supply-copy h2 > span { color: var(--fp-muted); margin-left: 6px; font-size: 12px; font-weight: 400; }.supply-copy p { margin: 6px 0 0; color: var(--fp-muted); font-size: 12px; }.supply-copy p > span { padding-inline: 5px; }
.desktop-settings { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 24px 4px; }.desktop-settings h2 { font-size: 14px; margin: 0; }.desktop-settings p { color: var(--fp-muted); font-size: 12px; margin: 6px 0 0; line-height: 1.6; }.desktop-buttons { display: flex; align-items: center; gap: 16px; }.text-button { padding: 8px 0; background: transparent; color: var(--fp-muted); border: 0; font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; }.text-button:hover { color: var(--fp-text); text-decoration: underline; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
.name-input:focus-within { border-color: var(--fp-primary); box-shadow: var(--fp-focus-ring); }
.name-input #pet-adoption-name { min-height: 42px; padding: 10px 12px; border: 0; background: transparent; box-shadow: none; outline: none; }
.pet-stat > .stat-track > span { display: block; height: 100%; }
.activity-mark { position: absolute; top: 15%; right: 9%; display: grid; place-items: center; width: 36px; height: 36px; z-index: 2; border: 1px solid var(--fp-border); border-radius: 10px; color: var(--fp-primary); background: var(--fp-card); }
@media (max-width: 1000px) { .daily-supplies { grid-template-columns: 1fr; }.pet-home { grid-template-columns: minmax(240px, .8fr) minmax(0, 1fr); }.care-panel { padding: 24px 20px; }.pet-stats { gap: 20px 16px; } }
@media (max-width: 720px) { .page-heading { margin-bottom: 16px; }.page-heading h1 { font-size: 24px; }.pet-home { grid-template-columns: 1fr; }.companion { padding: 20px; }.pet-scene { margin-top: -18px; margin-bottom: 0; }.pet-scene .pet-animation { width: 220px; }.care-panel { border-left: 0; border-top: 1px solid var(--fp-border); padding: 20px; }.species-options { grid-template-columns: 1fr 1fr; gap: 10px; }.species-option img { max-width: 140px; }.adoption { padding: 20px; }.adoption-form { flex-direction: column; align-items: stretch; }.name-input { max-width: none; }.desktop-settings { flex-direction: column; align-items: flex-start; gap: 12px; }.desktop-buttons { width: 100%; justify-content: space-between; }.section-heading h2 { font-size: 20px; }.pet-wallet { gap: 6px; padding: 10px 12px; }.pet-wallet strong { font-size: 18px; } }
@media (max-width: 720px) { .pet-name h2 { min-width: 0; }.pet-name button { margin-right: 0; }.icon-button { width: 44px; height: 44px; }.pet-primary, .pet-secondary, .text-button { min-height: 44px; }#pet-name, #pet-adoption-name { min-height: 44px; font-size: 16px; }.rename-form .icon-button { flex: none; } }
@media (max-width: 600px) {
  .companion { display: grid; grid-template-columns: minmax(0, 128px) minmax(0, 1fr); gap: 4px 12px; align-items: center; text-align: left; }
  .companion-heading { grid-column: 1 / -1; margin-bottom: 8px; }
  .pet-scene { grid-column: 1; grid-row: 2 / 5; width: 128px; max-width: 100%; margin: 0; }
  .pet-scene .pet-animation { width: 128px; }
  .pet-name, .rename-form, .pet-status, .rename-count, .companion > .form-error { grid-column: 2; }
  .pet-name { justify-content: flex-start; }.pet-name h2 { font-size: 20px; }
  .pet-status { justify-content: flex-start; margin: 0; line-height: 1.6; }
  .companion :deep(.growth-summary) { grid-column: 1 / -1; width: 100%; max-width: none; margin-top: 12px; text-align: center; }
  .rename-form { flex-wrap: wrap; }.rename-form input { flex-basis: 100%; }
}
@media (max-width: 390px) { .care-panel, .adoption { padding: 16px; }.pet-stats { gap: 20px 12px; }.pet-wallet > span { display: none; }.supply-panel { padding: 16px; }.supply-panel .pet-primary, .supply-panel .pet-secondary { padding-inline: 10px; font-size: 12px; }.species-description { font-size: 11px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } }
</style>
