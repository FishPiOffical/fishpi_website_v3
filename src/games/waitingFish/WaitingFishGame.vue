<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import {
  createCanvasFishGame,
  FISH_KINDS,
  LOGO_ASSETS,
  SHOP_ITEMS,
  type CanvasFishGame,
  type EncEntry,
  type GameHud,
  type Rarity,
} from './canvasGame'
import FishIcon from './FishIcon.vue'

type Panel = 'none' | 'enc' | 'shop'

const ENC_PAGE_SIZE = 12
const RARITY_TABS: Array<'全部' | Rarity> = ['全部', '常见', '少见', '稀有', '史诗', '传说', '神话']

const canvasRef = ref<HTMLCanvasElement | null>(null)
const game = ref<CanvasFishGame | null>(null)
const panel = ref<Panel>('none')
const encTab = ref<(typeof RARITY_TABS)[number]>('全部')
const encPage = ref(0)
const encPick = ref<string | null>(null)

const hud = reactive<GameHud>({
  score: 0,
  catches: 0,
  best: 0,
  bait: 12,
  lucky: 0,
  encFound: 0,
  encTotal: FISH_KINDS.length,
  message: '加载中…',
  lastCatch: '',
  phase: 'ready',
  encyclopedia: {},
})

const rarityClass: Record<string, string> = {
  常见: 'r-c',
  少见: 'r-u',
  稀有: 'r-r',
  史诗: 'r-e',
  传说: 'r-l',
  神话: 'r-m',
}

const filteredEnc = computed(() =>
  FISH_KINDS.filter((k) => encTab.value === '全部' || k.rarity === encTab.value).map((k) => {
    const e: EncEntry | undefined = hud.encyclopedia[k.id]
    return {
      kind: k,
      unlocked: !!e?.discovered,
      count: e?.count ?? 0,
      bestPoints: e?.bestPoints ?? 0,
    }
  }),
)

const encPageCount = computed(() => Math.max(1, Math.ceil(filteredEnc.value.length / ENC_PAGE_SIZE)))

const encPageCards = computed(() => {
  const start = encPage.value * ENC_PAGE_SIZE
  return filteredEnc.value.slice(start, start + ENC_PAGE_SIZE)
})

const selectedCard = computed(() => {
  const id = encPick.value
  if (!id) return encPageCards.value.find((c) => c.unlocked) ?? encPageCards.value[0] ?? null
  return filteredEnc.value.find((c) => c.kind.id === id) ?? null
})

watch(encTab, () => {
  encPage.value = 0
  encPick.value = null
})

watch(encPageCount, (n) => {
  if (encPage.value >= n) encPage.value = Math.max(0, n - 1)
})

onMounted(() => {
  if (!canvasRef.value) return
  const g = createCanvasFishGame(canvasRef.value, (h) => Object.assign(hud, h))
  game.value = g
  g.start()
})

onUnmounted(() => {
  game.value?.stop()
  game.value = null
})

function toggle(p: Panel) {
  panel.value = panel.value === p ? 'none' : p
}

function buy(id: string) {
  game.value?.buyShopItem(id)
}

function prevEnc() {
  encPage.value = Math.max(0, encPage.value - 1)
}

function nextEnc() {
  encPage.value = Math.min(encPageCount.value - 1, encPage.value + 1)
}

function tabCount(tab: (typeof RARITY_TABS)[number]) {
  if (tab === '全部') return hud.encFound
  return FISH_KINDS.filter((k) => k.rarity === tab && hud.encyclopedia[k.id]?.discovered).length
}

function tabTotal(tab: (typeof RARITY_TABS)[number]) {
  if (tab === '全部') return FISH_KINDS.length
  return FISH_KINDS.filter((k) => k.rarity === tab).length
}
</script>

<template>
  <div class="fish-game">
    <header class="fish-head">
      <div class="title-row">
        <h2>
          <span class="logo-mark" aria-hidden="true">
            <img :src="LOGO_ASSETS.cat" width="22" height="22" alt="" />
          </span>
          摸鱼等待 · 钓鱼
        </h2>
      </div>
      <p class="bar">
        <span>积分 {{ hud.score }}</span>
        <span>渔获 {{ hud.catches }}</span>
        <span>饵 {{ hud.bait }}</span>
        <span v-if="hud.lucky">闪光 {{ hud.lucky }}</span>
        <span>图鉴 {{ hud.encFound }}/{{ hud.encTotal }}</span>
        <span>最佳 {{ hud.best }}</span>
      </p>
      <p class="msg">{{ hud.message }}</p>
    </header>

    <div class="canvas-wrap">
      <canvas ref="canvasRef" role="img" aria-label="摸鱼钓鱼小游戏画布" />
    </div>

    <div class="quick">
      <button type="button" class="primary" @click="game?.cast()">抛竿</button>
      <button type="button" class="accent" :disabled="hud.phase !== 'bite'" @click="game?.tryReel()">
        收竿
      </button>
      <button type="button" :class="{ on: panel === 'enc' }" @click="toggle('enc')">图鉴</button>
      <button type="button" :class="{ on: panel === 'shop' }" @click="toggle('shop')">商城</button>
      <button type="button" class="ghost" @click="game?.newGame()">新开一局</button>
    </div>

    <section v-if="panel === 'enc'" class="sheet" aria-label="鱼类图鉴">
      <div class="sheet-head">
        <div>
          <h3>鱼类图鉴</h3>
          <p>{{ hud.encFound }}/{{ hud.encTotal }} 已解锁 · 首次捕获有积分奖励</p>
        </div>
        <button type="button" class="close" @click="panel = 'none'">收起</button>
      </div>

      <div class="tabs" role="tablist">
        <button
          v-for="tab in RARITY_TABS"
          :key="tab"
          type="button"
          role="tab"
          :class="{ on: encTab === tab }"
          :aria-selected="encTab === tab"
          @click="encTab = tab"
        >
          {{ tab }}
          <span class="n">{{ tabCount(tab) }}/{{ tabTotal(tab) }}</span>
        </button>
      </div>

      <div class="enc-body">
        <ul class="enc-tiles">
          <li
            v-for="card in encPageCards"
            :key="card.kind.id"
            :class="['tile', { locked: !card.unlocked, on: selectedCard?.kind.id === card.kind.id }]"
            @click="encPick = card.kind.id"
          >
            <div class="tile-art" aria-hidden="true">
              <template v-if="card.kind.id === 'logo'">
                <div class="logo-fish-art" :class="{ locked: !card.unlocked }">
                  <img v-if="card.unlocked" :src="LOGO_ASSETS.fish" alt="" class="lf-fish" />
                  <img v-if="card.unlocked" :src="LOGO_ASSETS.cat" alt="" class="lf-cat" />
                  <span v-else class="lf-q">?</span>
                </div>
              </template>
              <template v-else-if="card.unlocked">
                <FishIcon :kind="card.kind" :size="44" />
              </template>
              <span v-else class="lf-q">?</span>
            </div>
            <span class="tile-name">{{ card.unlocked ? card.kind.name : '？？？' }}</span>
            <span class="rarity" :class="rarityClass[card.kind.rarity]">{{ card.kind.rarity }}</span>
          </li>
        </ul>

        <aside v-if="selectedCard" class="enc-detail">
          <div class="detail-art" aria-hidden="true">
            <template v-if="selectedCard.kind.id === 'logo'">
              <div class="logo-fish-art big" :class="{ locked: !selectedCard.unlocked }">
                <img v-if="selectedCard.unlocked" :src="LOGO_ASSETS.fish" alt="" class="lf-fish" />
                <img v-if="selectedCard.unlocked" :src="LOGO_ASSETS.cat" alt="" class="lf-cat" />
                <span v-else class="lf-q">?</span>
              </div>
            </template>
            <FishIcon v-else-if="selectedCard.unlocked" :kind="selectedCard.kind" :size="96" />
            <span v-else class="lf-q big">?</span>
          </div>
          <div class="detail-meta">
            <div class="enc-name">
              <span>{{ selectedCard.unlocked ? selectedCard.kind.name : '？？？' }}</span>
              <span class="rarity" :class="rarityClass[selectedCard.kind.rarity]">
                {{ selectedCard.kind.rarity }}
              </span>
            </div>
            <p v-if="selectedCard.unlocked">{{ selectedCard.kind.blurb }}</p>
            <p v-else class="muted">尚未遇见，抛竿去找找吧</p>
            <p v-if="selectedCard.unlocked" class="stats">
              钓获 {{ selectedCard.count }} 次 · 单次最高 +{{ selectedCard.bestPoints }}
            </p>
          </div>
        </aside>
      </div>

      <div class="pager">
        <button type="button" :disabled="encPage <= 0" @click="prevEnc">上一页</button>
        <span>{{ encPage + 1 }} / {{ encPageCount }}</span>
        <button type="button" :disabled="encPage >= encPageCount - 1" @click="nextEnc">下一页</button>
      </div>
    </section>

    <section v-if="panel === 'shop'" class="sheet" aria-label="摸鱼商城">
      <div class="sheet-head">
        <div>
          <h3>摸鱼商城</h3>
          <p>积分 {{ hud.score }} · 饵 {{ hud.bait }}<template v-if="hud.lucky"> · 闪光 {{ hud.lucky }}</template></p>
        </div>
        <button type="button" class="close" @click="panel = 'none'">收起</button>
      </div>
      <ul class="shop-grid">
        <li v-for="item in SHOP_ITEMS" :key="item.id" class="shop-card">
          <div class="shop-icon" aria-hidden="true">
            <svg v-if="item.lucky && !item.bait" viewBox="0 0 40 40" width="32" height="32">
              <circle cx="20" cy="20" r="14" fill="#3a2a10" stroke="#f0c040" stroke-width="2" />
              <path
                d="M20 10 L22 18 L30 18 L24 23 L26 31 L20 26 L14 31 L16 23 L10 18 L18 18 Z"
                fill="#f0c040"
              />
            </svg>
            <svg v-else-if="item.lucky" viewBox="0 0 40 40" width="32" height="32">
              <ellipse cx="16" cy="22" rx="8" ry="5" fill="#6b4a2a" />
              <ellipse cx="28" cy="18" rx="6" ry="4" fill="#f0c040" opacity="0.9" />
              <circle cx="30" cy="12" r="3" fill="#ffe08a" />
            </svg>
            <svg v-else viewBox="0 0 40 40" width="32" height="32">
              <ellipse cx="20" cy="22" rx="11" ry="7" fill="#6b4a2a" />
              <ellipse cx="20" cy="20" rx="9" ry="5" fill="#8b6b4a" />
              <path d="M10 18 Q20 8 30 18" fill="none" stroke="#4a3220" stroke-width="1.5" />
            </svg>
          </div>
          <div class="shop-name">{{ item.name }}</div>
          <p>{{ item.desc }}</p>
          <button type="button" class="buy" :disabled="hud.score < item.cost" @click="buy(item.id)">
            {{ item.cost }} 积分
          </button>
        </li>
      </ul>
    </section>

    <p class="tip">咬钩时尽快点「收竿」或点击画面；太早/太晚都会空军。饵用完去商城买。</p>
  </div>
</template>

<style scoped>
.fish-game {
  margin-top: 22px;
  text-align: left;
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--fp-bg) 55%, var(--fp-card));
  overflow: hidden;
}
.fish-head {
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--fp-border);
  background: var(--fp-card);
}
.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
h2 {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  color: var(--fp-title);
  font-weight: 700;
}
.logo-mark {
  display: inline-flex;
  line-height: 0;
}
.logo-mark img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  display: block;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--fp-muted);
}
.bar span {
  white-space: nowrap;
}
.msg {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--fp-text);
  min-height: 1.3em;
}
.canvas-wrap {
  width: 100%;
  line-height: 0;
  background: #0c2a3a;
}
canvas {
  display: block;
  width: 100%;
  cursor: pointer;
  touch-action: manipulation;
}
.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px 6px;
  background: var(--fp-card);
}
.quick button,
.pager button,
.close,
.buy {
  border: 1px solid var(--fp-border);
  background: var(--fp-hover);
  color: var(--fp-text);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  font: inherit;
}
.quick button:hover:not(:disabled),
.pager button:hover:not(:disabled),
.close:hover {
  border-color: var(--fp-accent);
  color: var(--fp-accent);
}
.quick button:disabled,
.pager button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.quick button.primary {
  background: var(--fp-primary);
  border-color: var(--fp-primary);
  color: #fff;
}
.quick button.primary:hover {
  color: #fff;
  filter: brightness(1.06);
}
.quick button.accent {
  background: color-mix(in srgb, var(--fp-accent) 85%, #000);
  border-color: var(--fp-accent);
  color: #fff;
}
.quick button.accent:hover:not(:disabled) {
  color: #fff;
  filter: brightness(1.08);
}
.quick button.ghost {
  background: transparent;
  color: var(--fp-muted);
}
.quick button.on {
  border-color: var(--fp-accent);
  color: var(--fp-accent);
  background: color-mix(in srgb, var(--fp-accent) 12%, var(--fp-hover));
}

.sheet {
  border-top: 1px solid var(--fp-border);
  background: color-mix(in srgb, var(--fp-bg) 70%, var(--fp-card));
  padding: 12px;
}
.sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.sheet-head h3 {
  margin: 0;
  font-size: 14px;
  color: var(--fp-title);
}
.sheet-head p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--fp-muted);
}
.close {
  flex-shrink: 0;
  padding: 4px 10px;
  background: transparent;
  color: var(--fp-muted);
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 10px;
}
.tabs button {
  border: 1px solid var(--fp-border);
  background: var(--fp-card);
  color: var(--fp-muted);
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  font: inherit;
}
.tabs button .n {
  margin-left: 4px;
  opacity: 0.75;
}
.tabs button.on {
  border-color: var(--fp-accent);
  color: var(--fp-accent);
  background: color-mix(in srgb, var(--fp-accent) 12%, var(--fp-card));
}

.enc-body {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 10px;
  margin-top: 10px;
  align-items: stretch;
}
@media (max-width: 560px) {
  .enc-body {
    grid-template-columns: 1fr;
  }
}

.enc-tiles {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  min-height: 168px;
}
@media (max-width: 560px) {
  .enc-tiles {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px 6px;
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  background: var(--fp-card);
  cursor: pointer;
  min-width: 0;
}
.tile.locked {
  opacity: 0.65;
}
.tile.on {
  border-color: var(--fp-accent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fp-accent) 35%, transparent);
}
.tile-art {
  width: 48px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: color-mix(in srgb, #0c2a3a 55%, var(--fp-bg));
}
.tile-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--fp-title);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enc-detail {
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  background: var(--fp-card);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 168px;
}
.detail-art {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 64px;
  border-radius: 8px;
  background: color-mix(in srgb, #0c2a3a 50%, var(--fp-bg));
}
.detail-meta .enc-name {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 14px;
  font-weight: 700;
  color: var(--fp-title);
}
.detail-meta p {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--fp-text);
}
.detail-meta .muted,
.detail-meta .stats {
  color: var(--fp-muted);
}

.rarity {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid var(--fp-border);
  color: var(--fp-muted);
}
.rarity.r-c {
  color: #8a9aaa;
}
.rarity.r-u {
  color: #4db8a0;
  border-color: color-mix(in srgb, #4db8a0 40%, var(--fp-border));
}
.rarity.r-r {
  color: #6b8cff;
  border-color: color-mix(in srgb, #6b8cff 40%, var(--fp-border));
}
.rarity.r-e {
  color: #b07cff;
  border-color: color-mix(in srgb, #b07cff 45%, var(--fp-border));
}
.rarity.r-l {
  color: #e0a030;
  border-color: color-mix(in srgb, #e0a030 45%, var(--fp-border));
}
.rarity.r-m {
  color: #f0d0ff;
  border-color: color-mix(in srgb, #e8d0ff 50%, var(--fp-border));
}

.logo-fish-art {
  position: relative;
  width: 48px;
  height: 28px;
}
.logo-fish-art.big {
  width: 96px;
  height: 56px;
}
.logo-fish-art.locked {
  display: flex;
  align-items: center;
  justify-content: center;
}
.lf-fish {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.lf-cat {
  position: absolute;
  left: 42%;
  top: -8%;
  width: 48%;
  height: 60%;
  object-fit: contain;
}
.lf-q {
  font-size: 14px;
  font-weight: 700;
  color: #8a95a3;
}
.lf-q.big {
  font-size: 28px;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--fp-muted);
}
.pager button {
  padding: 4px 12px;
  background: var(--fp-card);
}

.shop-grid {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.shop-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  background: var(--fp-card);
}
.shop-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: color-mix(in srgb, #0c2a3a 40%, var(--fp-bg));
}
.shop-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--fp-title);
}
.shop-card p {
  margin: 0;
  font-size: 11px;
  color: var(--fp-muted);
  line-height: 1.4;
  flex: 1;
}
.buy {
  align-self: flex-start;
  margin-top: 4px;
  border-color: var(--fp-primary);
  background: var(--fp-primary);
  color: #fff;
}
.buy:hover:not(:disabled) {
  filter: brightness(1.06);
  color: #fff;
  border-color: var(--fp-primary);
}
.buy:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: var(--fp-border);
  background: var(--fp-hover);
  color: var(--fp-muted);
}

.tip {
  margin: 0;
  padding: 0 12px 12px;
  font-size: 11px;
  color: var(--fp-muted);
  background: var(--fp-card);
  line-height: 1.45;
}
.sheet + .tip {
  border-top: 1px solid var(--fp-border);
  padding-top: 10px;
}
</style>
