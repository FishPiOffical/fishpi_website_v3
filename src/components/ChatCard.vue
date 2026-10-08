<script lang="ts">
import { ref } from 'vue'

let audio: HTMLAudioElement | null = null
const playing = ref('')

function toggle(src: string) {
  if (!src) return
  if (!audio) {
    audio = new Audio()
    audio.addEventListener('ended', () => (playing.value = ''))
    audio.addEventListener('pause', () => (playing.value = ''))
  }
  if (playing.value === src) {
    audio.pause()
    return
  }
  audio.src = src
  void audio.play().then(
    () => (playing.value = src),
    () => (playing.value = ''),
  )
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { SITE_ORIGIN } from '@/seo/site'
import type { ChatCardData } from '@/utils/chatCard'

const props = defineProps<{ card: ChatCardData }>()

const WEATHER_NAMES: Record<string, string> = {
  CLEAR_DAY: '晴',
  CLEAR_NIGHT: '晴',
  PARTLY_CLOUDY_DAY: '多云',
  PARTLY_CLOUDY_NIGHT: '多云',
  CLOUDY: '阴',
  LIGHT_HAZE: '轻度雾霾',
  MODERATE_HAZE: '中度雾霾',
  HEAVY_HAZE: '重度雾霾',
  LIGHT_RAIN: '小雨',
  MODERATE_RAIN: '中雨',
  HEAVY_RAIN: '大雨',
  STORM_RAIN: '暴雨',
  FOG: '雾',
  LIGHT_SNOW: '小雪',
  MODERATE_SNOW: '中雪',
  HEAVY_SNOW: '大雪',
  STORM_SNOW: '暴雪',
  DUST: '浮尘',
  SAND: '沙尘',
  WIND: '大风',
}

function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  return typeof v === 'string' && v ? v.split(',') : []
}

const music = computed(() => (props.card.msgType === 'music' ? props.card : null))

const weather = computed(() => {
  if (props.card.msgType !== 'weather') return null
  const c = props.card
  const dates = list(c.date)
  const codes = list(c.weatherCode)
  const max = list(c.max)
  const min = list(c.min)
  return {
    title: c.t || '天气',
    sub: c.st || '',
    days: dates.map((date, i) => ({
      date,
      code: codes[i] || '',
      name: WEATHER_NAMES[codes[i] || ''] || codes[i] || '',
      max: max[i] ?? '',
      min: min[i] ?? '',
    })),
  }
})
</script>

<template>
  <div v-if="music" class="card music">
    <img class="cover" :src="music.coverURL || `${SITE_ORIGIN}/images/music/cat.gif`" alt="" />
    <div class="info">
      <div class="title" :title="music.title">{{ music.title || '未知歌曲' }}</div>
      <div v-if="music.from" class="from">{{ music.from }}</div>
      <button type="button" class="play" :disabled="!music.source" @click="toggle(music.source || '')">
        {{ playing && playing === music.source ? '❚❚ 暂停' : '▶ 播放' }}
      </button>
    </div>
  </div>
  <div v-else-if="weather" class="card weather">
    <div class="head">
      <strong>{{ weather.title }}</strong>
      <span v-if="weather.sub">{{ weather.sub }}</span>
    </div>
    <ol class="days">
      <li v-for="d in weather.days" :key="d.date">
        <span class="date">{{ d.date }}</span>
        <img v-if="d.code" :src="`${SITE_ORIGIN}/images/weather/svg/${d.code}.svg`" :alt="d.name" />
        <span class="name">{{ d.name }}</span>
        <span class="temp">
          <b>{{ d.max }}°</b><i>{{ d.min }}°</i>
        </span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.card {
  margin: 4px 0;
  border-radius: 8px;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
}
.music {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 260px;
  max-width: 100%;
  padding: 8px;
}
.cover {
  width: 56px;
  height: 56px;
  flex: none;
  border-radius: 6px;
  object-fit: cover;
}
.info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.title {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.from {
  font-size: 11px;
  color: var(--fp-muted);
}
.play {
  align-self: flex-start;
  margin-top: 2px;
  border: 0;
  border-radius: 999px;
  padding: 2px 10px;
  background: var(--fp-primary);
  color: #fff;
  font-size: 11px;
  cursor: pointer;
}
.play:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.weather {
  width: 300px;
  max-width: 100%;
  padding: 8px 10px;
}
.head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-bottom: 6px;
}
.head strong {
  font-size: 15px;
}
.head span {
  font-size: 11px;
  color: var(--fp-muted);
  text-align: center;
}
.days {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.days li {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 11px;
}
.days img {
  width: 28px;
  height: 28px;
}
.date,
.name {
  color: var(--fp-muted);
  white-space: nowrap;
}
.temp b {
  font-weight: 600;
  color: #e07a5f;
}
.temp i {
  margin-left: 3px;
  font-style: normal;
  color: #4a90d9;
}
</style>
