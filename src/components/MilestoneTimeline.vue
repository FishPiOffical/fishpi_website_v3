<script setup lang="ts">
import { computed } from 'vue'
import type { Milestone } from '@/api/v3-milestones'
import timelineScript from '@knight-lab/timelinejs/dist/js/timeline.js?raw'
import timelineCss from '@knight-lab/timelinejs/dist/css/timeline.css?raw'
import iconFont from '@knight-lab/timelinejs/dist/css/icons/tl-icons.woff2?inline'
import locale from '@knight-lab/timelinejs/dist/js/locale/zh-cn.json?raw'

const props = defineProps<{ events: Milestone[] }>()
const css = timelineCss
  .replace(/@font-face\s*\{[^}]*\}/, `@font-face{font-family:tl-icons;src:url("${iconFont}") format("woff2");font-display:block}`)
  .replace(/\/\*# sourceMappingURL=[^*]*\*\//g, '')
const script = timelineScript.replace(/\/\/# sourceMappingURL=[^\n]*$/, '')
const language = 'data:application/json,' + encodeURIComponent(locale) + '#.json'
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
function dateParts(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month, day }
}
const documentHtml = computed(() => {
  const events = props.events.map(item => ({
    unique_id: item.id,
    start_date: dateParts(item.date),
    ...(item.endDate ? { end_date: dateParts(item.endDate) } : {}),
    ...(item.media.type === 'image' && item.media.url ? {
      media: { url: new URL(item.media.url, 'https://fishpi.cn').href, caption: escape(item.media.caption) },
    } : {}),
    text: {
      headline: escape(item.title),
      text: item.contentHtml || escape(item.content),
    },
  }))
  const data = JSON.stringify({ events }).replace(/</g, '\\u003c')
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; connect-src data:; img-src https: http: data:; media-src https: http:">
    <style>${css} html,body,#timeline{height:100%;margin:0} .tl-timeline{font-family:system-ui,sans-serif}</style>
    <div id="timeline"></div><script>${script}<\/script>
    <script>new TL.Timeline('timeline', ${data}, { language: ${JSON.stringify(language)}, font: null, start_at_end: true });<\/script>
  </html>`
})
</script>

<template>
  <iframe class="milestone-timeline" title="摸鱼派大事记互动时间线" sandbox="allow-scripts" :srcdoc="documentHtml" />
</template>

<style scoped>
.milestone-timeline {
  display: block;
  width: 100%;
  height: clamp(450px, 65vh, 620px);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
  background: #fff;
}
</style>
