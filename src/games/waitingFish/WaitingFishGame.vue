<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import { createFishingGame } from './engine'

const game = createFishingGame()
const log = ref<string[]>([])
const input = ref('')
const logEl = ref<HTMLElement | null>(null)
const bar = reactive({
  points: 0,
  location: '',
  season: '',
  turn: 0,
  enc: '0/0',
  baitLeft: 0,
  catches: 0,
  casts: 0,
})

function refreshBar() {
  Object.assign(bar, game.statusBar())
}
refreshBar()

async function push(text: string) {
  log.value.push(text)
  if (log.value.length > 80) log.value = log.value.slice(-60)
  refreshBar()
  await nextTick()
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
}

function run(cmd: string) {
  const t = cmd.trim()
  if (!t) return
  void push(`› ${t}\n${game.cmd(t)}`)
}

function onSubmit() {
  const t = input.value
  input.value = ''
  run(t)
}

onMounted(() => {
  void push(game.cmd('status'))
  void push('等待的时候抛两竿？点下方按钮，或输入 help。')
})
</script>

<template>
  <div class="fish-game">
    <header class="fish-head">
      <div class="title-row">
        <h2>🎣 摸鱼等待 · 文字钓鱼</h2>
        <a
          class="credit"
          href="https://github.com/tutusagi/ai-fishing-game"
          target="_blank"
          rel="noopener"
          title="玩法灵感来源"
        >
          灵感
        </a>
      </div>
      <p class="bar">
        <span>{{ bar.points }} 点</span>
        <span>{{ bar.location }} · {{ bar.season }}</span>
        <span>图鉴 {{ bar.enc }}</span>
        <span>饵 {{ bar.baitLeft }}</span>
        <span>渔获 {{ bar.catches }}</span>
      </p>
    </header>

    <div ref="logEl" class="fish-log" aria-live="polite">
      <pre v-for="(line, i) in log" :key="i">{{ line }}</pre>
    </div>

    <div class="quick">
      <button type="button" @click="run('cast')">抛一竿</button>
      <button type="button" @click="run('cast 5')">连钓 5</button>
      <button type="button" @click="run('sell all')">卖渔获</button>
      <button type="button" @click="run('buy basic_worm 5')">买蚯蚓×5</button>
      <button type="button" @click="run('goto')">地点</button>
      <button type="button" @click="run('shop')">商店</button>
      <button type="button" @click="run('enc')">图鉴</button>
      <button type="button" class="ghost" @click="run('new')">新开一局</button>
    </div>

    <form class="fish-form" @submit.prevent="onSubmit">
      <input v-model="input" maxlength="80" placeholder="cast / buy glow_bait 3 / goto reed_river …" />
      <button type="submit">执行</button>
    </form>
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
  font-size: 15px;
  color: var(--fp-title);
  font-weight: 700;
}
.credit {
  font-size: 11px;
  color: var(--fp-muted);
  text-decoration: none;
}
.credit:hover {
  color: var(--fp-link);
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
.fish-log {
  height: min(280px, 42vh);
  overflow: auto;
  padding: 10px 14px;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--fp-text);
  scrollbar-width: thin;
}
.fish-log pre {
  margin: 0 0 10px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.fish-log pre:last-child {
  margin-bottom: 0;
}
.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--fp-border);
  background: var(--fp-card);
}
.quick button,
.fish-form button {
  border: 1px solid var(--fp-border);
  background: var(--fp-hover);
  color: var(--fp-text);
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  font: inherit;
}
.quick button:hover,
.fish-form button:hover {
  border-color: var(--fp-accent);
  color: var(--fp-accent);
}
.quick button.ghost {
  background: transparent;
  color: var(--fp-muted);
}
.fish-form {
  display: flex;
  gap: 8px;
  padding: 0 12px 12px;
  background: var(--fp-card);
}
.fish-form input {
  flex: 1;
  min-width: 0;
  height: 34px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--fp-bg);
  color: var(--fp-text);
  font: inherit;
  font-size: 13px;
}
.fish-form button {
  border-radius: 8px;
  padding: 0 14px;
  background: var(--fp-primary);
  border-color: var(--fp-primary);
  color: #fff;
}
.fish-form button:hover {
  color: #fff;
  filter: brightness(1.05);
}
</style>
