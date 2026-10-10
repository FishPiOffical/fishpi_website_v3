<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  fetchMembershipDetail,
  fetchMembershipLevels,
  openMembership,
  saveVipConfigApi,
  type MembershipLevel,
  type MembershipStatus,
} from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAppearanceStore } from '@/stores/appearance'
import { useAuthStore } from '@/stores/auth'
import { invalidateVipName, parseVipNameConfig, vipNameClass, vipNameStyle } from '@/composables/useVipNickname'

usePageSeo(() => ({
  title: '摸鱼派 VIP',
  path: '/vips',
  robots: 'noindex',
}))

const auth = useAuthStore()
const appearance = useAppearanceStore()
const { apiKey, account, isLoggedIn, isVip } = storeToRefs(auth)

const levels = ref<MembershipLevel[]>([])
const status = ref<MembershipStatus | null>(null)
const loading = ref(true)
const busyId = ref('')
const coupon = ref('')
const err = ref('')
const ok = ref('')
const period = ref<'monthly' | 'yearly'>('monthly')

// VIP 特效配置项
const configBold = ref(false)
const configUnderline = ref(false)
const configColor = ref('#e74c3c')
const configGradient = ref('')
const configSaving = ref(false)
const previewConfig = computed(() => parseVipNameConfig(true, {
  bold: configBold.value,
  underline: configUnderline.value,
  color: configGradient.value || configColor.value,
}))

// FAQ 展开状态
const openFaq = ref<number | null>(null)

const points = computed(() => Number(account.value?.userPoint || 0))

interface ProcessedVip {
  key: string
  name: string
  benefits: Record<string, unknown>
  monthly?: MembershipLevel
  yearly?: MembershipLevel
}

const vipGroups = computed(() => {
  const map: Record<string, ProcessedVip> = {}
  for (const lv of levels.value) {
    const key = lv.lvCode.split('_')[0]
    if (!map[key]) {
      let benefits: Record<string, unknown> = {}
      try {
        benefits = JSON.parse(lv.benefits || '{}')
      } catch {
        /* fallback */
      }
      map[key] = {
        key,
        name: lv.lvName,
        benefits,
      }
    }
    if (lv.durationType === '月卡' || lv.durationType?.includes('月')) {
      map[key].monthly = lv
    } else if (lv.durationType === '年卡' || lv.durationType?.includes('年')) {
      map[key].yearly = lv
    }
  }
  return Object.values(map)
})

function expiresText(ts?: number) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return String(ts)
  }
}

async function load() {
  loading.value = true
  err.value = ''
  try {
    levels.value = await fetchMembershipLevels()
    if (account.value?.oId) {
      status.value = await fetchMembershipDetail(account.value.oId)
      if (status.value?.configJson) {
        try {
          const cfg = typeof status.value.configJson === 'string'
            ? JSON.parse(status.value.configJson)
            : status.value.configJson
          configBold.value = Boolean(cfg.bold)
          configUnderline.value = Boolean(cfg.underline)
          if (cfg.color) {
            if (cfg.color.startsWith('#')) {
              configColor.value = cfg.color
            } else {
              configGradient.value = cfg.color
            }
          }
        } catch {
          /* fallback */
        }
      }
    } else {
      status.value = null
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function buy(level?: MembershipLevel) {
  ok.value = ''
  err.value = ''
  if (!level) return
  if (!apiKey.value) {
    err.value = '请先登录'
    return
  }
  if (isVip.value) {
    err.value = '当前已是会员，请等待当前周期结束后再续费或开通'
    return
  }
  if (points.value < level.price) {
    err.value = `积分不足（需要 ${level.price}，当前 ${points.value}）。可先去捐助兑换积分。`
    return
  }
  if (!window.confirm(`确认花费 ${level.price} 积分开通「${level.lvName}」${level.durationType}？`)) return
  busyId.value = level.oId
  try {
    await openMembership(apiKey.value, level.oId, coupon.value.trim())
    ok.value = '恭喜！VIP 会员开通成功！'
    await auth.reloadAccount()
    await auth.refreshMembership()
    appearance.enforceVip()
    await load()
  } catch (e) {
    err.value = e instanceof Error ? e.message : '开通失败'
  } finally {
    busyId.value = ''
  }
}

async function saveVipConfig() {
  if (!apiKey.value) return
  configSaving.value = true
  ok.value = ''
  err.value = ''
  try {
    const finalColor = configGradient.value || configColor.value
    await saveVipConfigApi(apiKey.value, {
      bold: configBold.value,
      underline: configUnderline.value,
      color: finalColor,
    })
    invalidateVipName(account.value?.oId, account.value?.userName)
    ok.value = 'VIP 专属效果配置已成功保存！'
    await auth.reloadAccount()
  } catch (e) {
    err.value = e instanceof Error ? e.message : '保存配置失败'
  } finally {
    configSaving.value = false
  }
}

function setGradient(name: string) {
  configGradient.value = configGradient.value === name ? '' : name
}

function toggleFaq(i: number) {
  openFaq.value = openFaq.value === i ? null : i
}

onMounted(async () => {
  if (apiKey.value && !account.value) await auth.restore()
  await load()
})
</script>

<template>
  <div class="vip-container">
    <!-- 顶部横幅卡片网格 (对齐现网 Rhythm PC #vipGrid) -->
    <section class="banner-grid">
      <div v-for="vip in vipGroups" :key="vip.key" class="top-hero-card">
        <div class="hero-icon-box">
          <span class="icon-crown">👑</span>
        </div>
        <h3>{{ vip.name }}</h3>
        <p v-if="vip.monthly">
          限时特惠: <b>{{ vip.monthly.price.toLocaleString() }}</b> 积分/月
        </p>
        <button
          type="button"
          class="hero-buy-btn"
          :class="{ disabled: isVip }"
          :disabled="isVip || !vip.monthly"
          @click="buy(vip.monthly)"
        >
          {{ isVip ? '已是 VIP' : '立即开通' }}
        </button>
      </div>
    </section>

    <!-- 会员专属配置与实时预览卡片 (已开通时展示，对齐现网 Rhythm #vipConfigBox) -->
    <section v-if="isVip && status" class="vip-config-module">
      <div class="vip-status-header">
        🎉 欢迎尊贵的
        <span class="highlight-level">{{ status.lvCode || '摸鱼派 VIP' }}</span>
        用户，您的会员到期时间为：
        <span class="highlight-date">{{ expiresText(status.expiresAt) }}</span>
      </div>

      <div class="preview-section">
        <div class="preview-label">VIP 昵称效果预览:</div>
        <div class="preview-box">
          <span
            class="preview-name"
            :class="vipNameClass(previewConfig)"
            :style="vipNameStyle(previewConfig)"
          >
            {{ account?.userNickname || account?.userName || '我的专属昵称' }}
          </span>
        </div>

        <!-- 基础样式调节 -->
        <div class="style-controls">
          <button
            type="button"
            class="ctrl-btn"
            :class="{ active: configBold }"
            @click="configBold = !configBold"
          >
            <b>B</b> 加粗
          </button>
          <button
            type="button"
            class="ctrl-btn"
            :class="{ active: configUnderline }"
            @click="configUnderline = !configUnderline"
          >
            <u>U</u> 下划线
          </button>
          <label class="color-picker-label" title="选择自定义文本色彩">
            <span>色彩:</span>
            <input v-model="configColor" type="color" @input="configGradient = ''" />
          </label>
        </div>

        <!-- VIP 高级/至尊渐变光效选择 -->
        <div class="advanced-effects">
          <div class="effect-label">高级动态流光特效 (点击切换):</div>
          <div class="effects-btn-group">
            <button
              v-for="(label, name) in {
                rainbow: '🌈 彩虹光效',
                neon: '💡 霓虹光效',
                fire: '🔥 炽焰光效',
                ocean: '🌊 海洋流光',
                forest: '🌲 翠林光效',
                sunset: '🌅 晚霞落日',
                metal: '🪙 金银金属',
                galaxy: '🌌 星空银河',
              }"
              :key="name"
              type="button"
              class="effect-btn"
              :class="[name, { selected: configGradient === name }]"
              @click="setGradient(name)"
            >
              {{ label }}
            </button>
          </div>
        </div>

        <div class="save-action">
          <button
            type="button"
            class="save-btn"
            :disabled="configSaving"
            @click="saveVipConfig"
          >
            {{ configSaving ? '正在保存…' : '保存配置' }}
          </button>
        </div>
      </div>
    </section>

    <!-- 方案选择定价卡片 (对齐现网 Rhythm .pricing) -->
    <section class="pricing-section">
      <h2 class="section-title">选择适合您的方案</h2>

      <!-- 计费周期 Tab -->
      <div class="period-tabs">
        <button
          type="button"
          class="period-tab"
          :class="{ active: period === 'monthly' }"
          @click="period = 'monthly'"
        >
          按月计费
        </button>
        <button
          type="button"
          class="period-tab"
          :class="{ active: period === 'yearly' }"
          @click="period = 'yearly'"
        >
          按年计费 (立省2个月)
        </button>
      </div>

      <!-- 提示信息 -->
      <p v-if="err" class="alert-msg err">{{ err }}</p>
      <p v-if="ok" class="alert-msg ok">{{ ok }}</p>

      <div class="pricing-cards-grid">
        <div
          v-for="vip in vipGroups"
          :key="vip.key"
          class="pricing-card"
          :class="{ popular: vip.key === 'VIP2' || vip.key === 'VIP4' }"
        >
          <div v-if="vip.key === 'VIP2'" class="popular-badge">最受欢迎</div>
          <div v-else-if="vip.key === 'VIP4'" class="popular-badge至尊">至尊尊荣</div>

          <div class="card-main-info">
            <h3 class="plan-name">{{ vip.name }}</h3>

            <div class="price-wrap">
              <template v-if="period === 'monthly'">
                <span class="price-num">{{ vip.monthly?.price.toLocaleString() ?? '—' }}</span>
                <span class="price-unit">积分 / 月</span>
              </template>
              <template v-else>
                <span class="price-num">{{ vip.yearly?.price.toLocaleString() ?? '—' }}</span>
                <span class="price-unit">积分 / 年</span>
                <div v-if="vip.monthly && vip.yearly" class="price-savings">
                  立省 {{ (vip.monthly.price * 2).toLocaleString() }} 积分
                </div>
              </template>
            </div>

            <!-- 特权清单 (对齐现网 Rhythm) -->
            <ul class="pricing-features">
              <li v-if="vip.benefits.bold != null">
                <span class="check-icon">✓</span> 专属昵称加粗
              </li>
              <li v-if="vip.benefits.underline != null">
                <span class="check-icon">✓</span> 专属昵称下划线
              </li>
              <li v-if="vip.benefits.color != null">
                <span class="check-icon">✓</span> {{ vip.key === 'VIP4' ? '全屏尊贵流光渐变' : '自定义昵称色彩' }}
              </li>
              <li v-if="vip.benefits.autoCheckin != null">
                <span class="check-icon">✓</span> 年付全自动签到
              </li>
              <li v-if="vip.benefits.checkinCard != null">
                <span class="check-icon">✓</span> 专属免签卡: {{ vip.benefits.checkinCard }} 张
              </li>
              <li v-if="vip.benefits.metal != null">
                <span class="check-icon">✓</span> DIY 动态勋章
              </li>
              <li v-if="vip.benefits.jointVip != null">
                <span class="check-icon">✓</span> 跨平台联合会员支持
              </li>
              <li v-if="vip.key === 'VIP4'">
                <span class="check-icon">✓</span> 全站积分交易免除手续费
              </li>
            </ul>
          </div>

          <div class="card-action">
            <button
              type="button"
              class="plan-btn"
              :class="{ disabled: isVip || !isLoggedIn }"
              :disabled="isVip || !isLoggedIn"
              @click="buy(period === 'monthly' ? vip.monthly : vip.yearly)"
            >
              {{ !isLoggedIn ? '请先登录' : isVip ? '当前已是 VIP' : '立即开通' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 常见问题折叠面板 (对齐现网 Rhythm .faq-section) -->
    <section class="faq-section">
      <h2 class="section-title">常见问题</h2>
      <div class="accordion">
        <div class="accordion-item">
          <button type="button" class="accordion-header" :class="{ active: openFaq === 0 }" @click="toggleFaq(0)">
            <span>是否可以申请退款？</span>
            <span class="arrow">{{ openFaq === 0 ? '▲' : '▼' }}</span>
          </button>
          <div v-show="openFaq === 0" class="accordion-content">
            <p>会员为虚拟数字化增值服务，一旦扣减积分开通成功后，不支持申请退款与积分退回。</p>
          </div>
        </div>

        <div class="accordion-item">
          <button type="button" class="accordion-header" :class="{ active: openFaq === 1 }" @click="toggleFaq(1)">
            <span>什么是联合会员？</span>
            <span class="arrow">{{ openFaq === 1 ? '▲' : '▼' }}</span>
          </button>
          <div v-show="openFaq === 1" class="accordion-content">
            <p>
              “联合会员”是【FishPI 机器人开放平台】推出的一项特权服务。用户只需一次订阅、一个会员身份，即可在平台所有已对接的第三方机器人应用/程序中自动解锁对应的 VIP 高级功能。
            </p>
          </div>
        </div>

        <div class="accordion-item">
          <button type="button" class="accordion-header" :class="{ active: openFaq === 2 }" @click="toggleFaq(2)">
            <span>是否支持从低级会员升级至高级会员？</span>
            <span class="arrow">{{ openFaq === 2 ? '▲' : '▼' }}</span>
          </button>
          <div v-show="openFaq === 2" class="accordion-content">
            <p>暂不支持直接补差价升级，请在当前会员周期到期结束后，按需重新选购开通更高等级的方案。</p>
          </div>
        </div>

        <div class="accordion-item">
          <button type="button" class="accordion-header" :class="{ active: openFaq === 3 }" @click="toggleFaq(3)">
            <span>DIY 动态勋章是永久生效的吗？</span>
            <span class="arrow">{{ openFaq === 3 ? '▲' : '▼' }}</span>
          </button>
          <div v-show="openFaq === 3" class="accordion-content">
            <p>DIY 动态勋章权益仅在会员有效期内有效，会员过期后会随之回收。</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.vip-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 30px 16px 60px;
}

/* 顶部横幅卡片网格 */
.banner-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 36px;
}

.top-hero-card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  box-shadow: var(--fp-card-shadow);
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.top-hero-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.hero-icon-box {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e59230, #efd35d);
  display: grid;
  place-items: center;
  font-size: 26px;
  margin-bottom: 14px;
}

.top-hero-card h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: var(--fp-title);
}

.top-hero-card p {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--fp-muted);
}

.top-hero-card p b {
  color: #e59230;
  font-size: 15px;
}

.hero-buy-btn {
  background: #e59230;
  color: #fff;
  border: 0;
  padding: 7px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.hero-buy-btn.disabled,
.hero-buy-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

/* VIP 配置箱与预览 */
.vip-config-module {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  box-shadow: var(--fp-card-shadow);
  padding: 26px;
  margin-bottom: 40px;
  text-align: center;
}

.vip-status-header {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--fp-title);
}

.highlight-level {
  color: #e74c3c;
  margin: 0 4px;
}

.highlight-date {
  color: #e59230;
  margin-left: 4px;
}

.preview-section {
  max-width: 680px;
  margin: 0 auto;
}

.preview-label {
  font-weight: 600;
  font-size: 15px;
  color: var(--fp-title);
  margin-bottom: 12px;
}

.preview-box {
  background: var(--fp-hover);
  border: 1px dashed var(--fp-border);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
}

.preview-name {
  font-size: 26px;
  display: inline-block;
  transition: all 0.2s ease;
}

/* 流光特效 CSS */
.rainbow {
  background: linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #00ffff, #0000ff, #8b00ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: flow 4s linear infinite;
}

.neon {
  color: #00ffcc;
  text-shadow: 0 0 10px #00ffcc, 0 0 20px #00ffcc;
}

.fire {
  background: linear-gradient(0deg, #ff0844 0%, #ffb199 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.ocean {
  background: linear-gradient(120deg, #1fa2ff, #12d8fa, #a6ffcb);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.forest {
  background: linear-gradient(120deg, #134e5e, #71b280);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.sunset {
  background: linear-gradient(120deg, #fa709a, #fee140);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.metal {
  background: linear-gradient(120deg, #bdc3c7, #2c3e50);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.galaxy {
  background: linear-gradient(120deg, #654ea3, #eaafc8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.style-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.ctrl-btn {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-title);
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}

.ctrl-btn.active {
  border-color: #e59230;
  color: #e59230;
  font-weight: 600;
}

.color-picker-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--fp-muted);
}

.color-picker-label input {
  width: 32px;
  height: 28px;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.advanced-effects {
  margin-bottom: 20px;
}

.effect-label {
  font-size: 13px;
  color: var(--fp-muted);
  margin-bottom: 10px;
}

.effects-btn-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.effect-btn {
  border: 1px solid var(--fp-border);
  background: var(--fp-card);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  color: var(--fp-title);
}

.effect-btn.selected {
  border-color: #e59230;
  box-shadow: 0 0 6px rgba(229, 146, 48, 0.4);
}

.save-btn {
  background: #e59230;
  color: #fff;
  border: 0;
  padding: 8px 30px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

/* 方案区域 */
.pricing-section {
  margin-bottom: 50px;
  text-align: center;
}

.section-title {
  font-size: 24px;
  color: var(--fp-title);
  margin-bottom: 20px;
}

.period-tabs {
  display: inline-flex;
  background: var(--fp-hover);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--fp-border);
  margin-bottom: 30px;
}

.period-tab {
  border: 0;
  background: transparent;
  padding: 8px 22px;
  border-radius: 6px;
  font-size: 14px;
  color: var(--fp-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.period-tab.active {
  background: #e59230;
  color: #fff;
  font-weight: 600;
}

.alert-msg {
  max-width: 600px;
  margin: 0 auto 16px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
}

.alert-msg.err {
  background: rgba(231, 76, 60, 0.1);
  color: #c0392b;
}

.alert-msg.ok {
  background: rgba(39, 174, 96, 0.1);
  color: #27ae60;
}

.pricing-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 28px;
  align-items: stretch;
}

.pricing-card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  box-shadow: var(--fp-card-shadow);
  padding: 30px 24px 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  transition: transform 0.25s ease;
}

.pricing-card:hover {
  transform: translateY(-4px);
}

.pricing-card.popular {
  border: 2px solid #e59230;
}

.popular-badge,
.popular-badge至尊 {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: #e59230;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 12px;
  border-radius: 20px;
}

.popular-badge至尊 {
  background: linear-gradient(90deg, #8e44ad, #e74c3c);
}

.plan-name {
  margin: 0 0 16px;
  font-size: 20px;
  color: var(--fp-title);
}

.price-wrap {
  margin-bottom: 24px;
}

.price-num {
  font-size: 32px;
  font-weight: 700;
  color: var(--fp-title);
}

.price-unit {
  font-size: 13px;
  color: var(--fp-muted);
  margin-left: 4px;
}

.price-savings {
  margin-top: 4px;
  font-size: 12px;
  color: #e59230;
  font-weight: 500;
}

.pricing-features {
  list-style: none;
  margin: 0 0 24px;
  padding: 0;
  text-align: left;
}

.pricing-features li {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--fp-text);
}

.check-icon {
  color: #27ae60;
  font-weight: bold;
}

.plan-btn {
  width: 100%;
  background: #e59230;
  color: #fff;
  border: 0;
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.plan-btn.disabled,
.plan-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

/* FAQ 手风琴折叠面板 */
.faq-section {
  max-width: 800px;
  margin: 0 auto;
}

.accordion {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--fp-card-shadow);
}

.accordion-item {
  border-bottom: 1px solid var(--fp-border);
}

.accordion-item:last-child {
  border-bottom: 0;
}

.accordion-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: transparent;
  border: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--fp-title);
  cursor: pointer;
  text-align: left;
}

.accordion-header.active {
  color: #e59230;
}

.arrow {
  font-size: 11px;
  color: var(--fp-muted);
}

.accordion-content {
  padding: 0 20px 16px;
  font-size: 13px;
  color: var(--fp-muted);
  line-height: 1.6;
}

.accordion-content p {
  margin: 0;
}
</style>
