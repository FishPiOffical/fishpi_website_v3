<script setup lang="ts">
import { petPortrait } from '@/components/pets/animations'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import FpDialog from '@/components/FpDialog.vue'
import { getAuthContextVersion } from '@/api/http'
import { normalizePetName, petNameLength, type PetSpeciesId } from '@/api/v3-pets'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'
import PetIcon from './PetIcon.vue'

const pets = usePetsStore(), auth = useAuthStore()
const opened = ref(false), selected = ref<PetSpeciesId>('hexiaotun'), name = ref(''), accepted = ref(false), validation = ref('')
const opener = ref<HTMLButtonElement | null>(null), panel = ref<HTMLElement | null>(null)
const price = computed(() => pets.catalog?.readoptionRules.coins)
const species = computed(() => pets.catalog?.species.find(item => item.id === selected.value))
const locked = computed(() => pets.loading || pets.busy || !!pets.pending || pets.refreshNeeded)
const pending = computed(() => pets.pending?.kind === 'readoption')
const unavailable = computed(() => pets.pet?.activity ? '请先结束当前活动并领取成果' : price.value === undefined ? '暂时无法读取领养费用' : (pets.coins ?? 0) < price.value ? '宠物币不足' : '')
const error = computed(() => {
  const text = pets.pendingError || pets.error
  return /JSON|HTTP|SQL|fetch|network|token|stack|接口|数据格式/i.test(text) ? '暂时无法确认操作结果，请稍后核对。' : text
})
let previousOverflow: string | null = null, sequence = 0
function open() {
  if (locked.value || !pets.pet) return
  selected.value = pets.pet.speciesId; name.value = ''; accepted.value = false; validation.value = ''; opened.value = true
}
function close() { if (!pets.busy) opened.value = false }
async function submit() {
  if (locked.value || unavailable.value || !species.value || !accepted.value) return
  validation.value = ''
  try {
    const normalized = normalizePetName(name.value || species.value.name)
    if (await pets.readopt(selected.value, normalized, accepted.value)) opened.value = false
  } catch (reason) { validation.value = reason instanceof Error ? reason.message : '请检查宠物名字' }
}
async function recover() {
  // 写入已确认便关闭旧确认；后置读取失败交给家园恢复读取，不能再次扣费。
  if (pending.value && await pets.retryPending()) opened.value = false
}
function trap(event: KeyboardEvent) {
  if (!opened.value || event.key !== 'Tab') return
  const dialog = panel.value?.closest('[role="dialog"]')
  const nodes = [...dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]') || []].filter(node => node.getClientRects().length)
  const first = nodes[0], last = nodes.at(-1)
  if (!first) { event.preventDefault(); panel.value?.focus(); return }
  if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
}
function unlock() {
  if (typeof document === 'undefined') return
  document.removeEventListener('keydown', trap)
  if (previousOverflow !== null) { if (document.body.style.overflow === 'hidden') document.body.style.overflow = previousOverflow; previousOverflow = null }
}
watch(opened, async value => {
  const run = ++sequence
  if (!value) { unlock(); await nextTick(); if (run === sequence) opener.value?.focus(); return }
  previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; document.addEventListener('keydown', trap)
  await nextTick(); if (run === sequence && opened.value) panel.value?.focus()
})
// 新宠物已生效时废弃旧确认，避免历史草稿再次提交；普通令牌轮换不清输入。
watch(() => pets.pet?.id, (value, previous) => { if (value !== previous) { opened.value = false; accepted.value = false; name.value = '' } })
watch(() => `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}`, () => { opened.value = false; accepted.value = false; name.value = ''; validation.value = '' }, { flush: 'sync' })
onBeforeUnmount(() => { sequence++; unlock() })
</script>

<template>
  <section v-if="pets.pet && pets.catalog" class="pet-readoption" aria-labelledby="pet-readoption-title">
    <div><h2 id="pet-readoption-title">重新选择伙伴</h2><p>重置宠物成长，账号中的背包与收藏会保留。<span v-if="price !== undefined">需要 {{ price }} 宠物币。</span></p></div><button ref="opener" type="button" class="readoption-open" :disabled="locked" title="查看重新领养规则" @click="open">重新领养<PetIcon name="chevron" /></button>
    <FpDialog :open="opened" title="重新领养宠物" :width="580" :persistent="pets.busy" :closable="!pets.busy" @close="close">
      <form ref="panel" class="readoption-form" tabindex="-1" @submit.prevent="submit">
        <p class="readoption-intro">本次需要 <strong>{{ price }} 宠物币</strong>。请先选好新伙伴，再确认要重置的内容。</p>
        <fieldset class="readoption-species"><legend>选择新伙伴</legend><label v-for="item in pets.catalog.species" :key="item.id" :class="{ selected: selected === item.id }"><input v-model="selected" type="radio" name="readoption-species" :value="item.id" :disabled="locked" /><img :src="petPortrait(item.id)" width="96" height="96" alt="" /><span>{{ item.name }}</span></label></fieldset>
        <div class="readoption-name"><label for="readoption-name">新伙伴的名字<span>{{ petNameLength(name || species?.name || '') }} / {{ pets.catalog.rules.maxNameLength }}</span></label><input id="readoption-name" v-model="name" :placeholder="species?.name" autocomplete="off" :disabled="locked" /></div>
        <div class="readoption-rules"><div><h3>重新开始</h3><p>宠物回到初始等级，经验、亲密度、课程技能和职业熟练度归零。</p></div><div><h3>继续保留</h3><p>剩余宠物币、背包、收藏、成长旅程进度和已领奖励，以及旧伙伴的活动记录。</p></div></div>
        <p class="readoption-note">当日补给、收入与成长额度、互动冷却继续沿用，不会再次发放首次领养奖励。</p>
        <label class="readoption-accept"><input v-model="accepted" type="checkbox" :disabled="locked" /><span>我已了解：花费 {{ price }} 宠物币，重置当前宠物成长，开始照顾新伙伴。</span></label>
        <p v-if="validation" class="readoption-error" role="alert">{{ validation }}</p>
        <div v-if="pending && !pets.busy" class="readoption-feedback" role="status"><span>{{ error || '结果尚未确认，请先核对原操作，不要重复领养。' }}</span><button type="button" class="readoption-retry" aria-label="核对重新领养操作" title="核对原操作" @click="recover"><PetIcon name="refresh" /></button></div>
        <p v-else-if="error" class="readoption-error" role="alert">{{ error }}</p>
        <p v-if="unavailable" class="readoption-note">{{ unavailable }}</p>
        <div class="readoption-actions"><button type="button" :disabled="pets.busy" @click="close">取消</button><button type="submit" class="readoption-submit" :disabled="locked || !!unavailable || !accepted || !species || petNameLength(name || species.name) > pets.catalog.rules.maxNameLength">{{ pets.busy ? '正在处理…' : `花费 ${price} 币重新领养` }}</button></div>
      </form>
    </FpDialog>
  </section>
</template>

<style scoped>
.pet-readoption { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding: 20px 4px; border-top: 1px solid var(--fp-border); }.pet-readoption h2 { margin: 0; color: var(--fp-text); font-size: 14px; }.pet-readoption > div > p { margin: 6px 0 0; color: var(--fp-muted); font-size: 12px; line-height: 1.7; }.readoption-open { display: flex; align-items: center; gap: 7px; min-height: 40px; padding: 9px 0 9px 12px; border: 0; background: transparent; font: inherit; font-size: 12px; color: var(--fp-muted); cursor: pointer; }.readoption-open svg { width: 14px; height: 14px; }.readoption-open:hover:not(:disabled) { color: var(--fp-title); }
.readoption-form { display: flex; flex-direction: column; gap: 18px; outline: none; }.readoption-intro { color: var(--fp-muted); font-size: 13px; line-height: 1.7; margin: 0; }.readoption-intro strong { color: var(--fp-text); }.readoption-species { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 0; margin: 0; border: 0; }.readoption-species legend { margin-bottom: 10px; color: var(--fp-text); font-size: 13px; font-weight: 600; }.readoption-species label { position: relative; display: flex; flex-direction: column; align-items: center; padding: 8px 4px 10px; border: 1px solid var(--fp-border); border-radius: 9px; cursor: pointer; }.readoption-species .selected { color: var(--fp-primary); border-color: var(--fp-primary); background: var(--fp-primary-soft); }.readoption-species input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }.readoption-species img { display: block; width: min(100%, 96px); height: auto; aspect-ratio: 1; object-fit: contain; }.readoption-species span { font-size: 12px; }.readoption-species label:has(:focus-visible) { outline: 2px solid var(--fp-primary); outline-offset: 3px; }.readoption-species label:has(:disabled) { cursor: default; }
.readoption-name label { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; font-size: 13px; font-weight: 600; }.readoption-name label > span { color: var(--fp-muted); font-size: 11px; font-weight: 400; }.readoption-name input { box-sizing: border-box; display: block; width: 100%; min-height: 42px; padding: 10px 12px; border: 1px solid var(--fp-border); border-radius: 8px; background: var(--fp-bg); color: var(--fp-text); font: inherit; font-size: 13px; }
.readoption-rules { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px; border-radius: 9px; background: var(--fp-bg); }.readoption-rules h3 { margin: 0 0 8px; color: var(--fp-title); font-size: 12px; }.readoption-rules p { margin: 0; font-size: 12px; line-height: 1.8; color: var(--fp-muted); }.readoption-note { color: var(--fp-muted); font-size: 12px; line-height: 1.7; margin: 0; }.readoption-accept { display: flex; align-items: flex-start; gap: 9px; font-size: 12px; line-height: 1.8; cursor: pointer; }.readoption-accept input { flex: none; margin: 4px 0 0; width: 15px; height: 15px; accent-color: var(--fp-primary); }.readoption-error { margin: 0; color: var(--fp-danger); font-size: 12px; line-height: 1.7; }.readoption-feedback { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; background: var(--fp-primary-soft); font-size: 12px; line-height: 1.7; }.readoption-feedback > span { flex: 1; }.readoption-retry { display: grid; place-items: center; flex: none; width: 36px; height: 36px; padding: 0; background: var(--fp-card); border: 1px solid var(--fp-border); border-radius: 8px; color: var(--fp-text); cursor: pointer; }
.readoption-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }.readoption-actions button { min-height: 42px; padding: 10px 14px; background: var(--fp-card); border: 1px solid var(--fp-border); border-radius: 8px; color: var(--fp-text); font: inherit; font-size: 13px; cursor: pointer; }.readoption-actions .readoption-submit { color: #fff; background: var(--fp-primary); border-color: transparent; }button:disabled { cursor: default; opacity: .5; }button:not(:disabled):hover { filter: brightness(.97); }button:focus-visible, input:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
@media (max-width: 600px) { .readoption-species { grid-template-columns: 1fr 1fr; }.readoption-species img { width: 72px; }.readoption-rules { grid-template-columns: 1fr; gap: 14px; }.readoption-open, .readoption-actions button, .readoption-name input, .readoption-accept { min-height: 44px; }.readoption-actions { display: grid; grid-template-columns: 1fr; }.readoption-actions button:first-child { order: 1; }.readoption-form { gap: 16px; } }
</style>
