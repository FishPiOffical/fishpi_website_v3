<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { usePageSidebarStore, type PageSidebarModuleId } from '@/stores/pageSidebar'
import CheckinPanel from '@/components/home/CheckinPanel.vue'
import PersonInfoCard from '@/components/sidebar/PersonInfoCard.vue'
import BreezemoonFeed from '@/components/sidebar/BreezemoonFeed.vue'
import SidebarConfigureButton from '@/components/sidebar/SidebarConfigureButton.vue'
import SidebarModuleHeader from '@/components/sidebar/SidebarModuleHeader.vue'
import IncomeModule from '@/chat/sidebar/modules/IncomeModule.vue'
import AppearanceModule from '@/chat/sidebar/modules/AppearanceModule.vue'
import AdModule from '@/chat/sidebar/modules/AdModule.vue'

const router = useRouter()
const { isLoggedIn } = storeToRefs(useAuthStore())
const pageSidebar = usePageSidebarStore()
const { visibleModules } = storeToRefs(pageSidebar)
const renderedModules = computed(() =>
  visibleModules.value.filter((mod) => mod.id !== 'checkin' || isLoggedIn.value),
)
const uid = useId()
// Identity and locally saved module layout are browser state, unavailable to public SSR.
const ready = ref(false)
onMounted(() => { ready.value = true })

const summaries = ref<Partial<Record<PageSidebarModuleId, string>>>({})

function goDownload() {
  void router.push('/download')
}
</script>

<template>
  <aside class="sidebar-wrapper" aria-label="内页侧边栏">
    <p v-if="!ready" class="empty-side" role="status">正在加载侧栏…</p>
    <template v-else>
      <section
        v-for="(mod, index) in renderedModules"
        :key="mod.id"
        class="module side-module-card"
        :class="{ 'is-collapsed': pageSidebar.isCollapsed(mod.id) }"
      >
        <header class="module-header side-module-head">
          <SidebarModuleHeader
            :module-id="mod.id"
            :title="mod.title"
            :expanded="!pageSidebar.isCollapsed(mod.id)"
            :controls="`${uid}-${mod.id}`"
            :summary="summaries[mod.id]"
            heading="h2"
            @toggle="pageSidebar.toggleCollapsed(mod.id)"
          />
          <RouterLink v-if="mod.id === 'breezemoons'" to="/breezemoons" class="more-link">更多</RouterLink>
          <SidebarConfigureButton v-if="index === 0" section="pageSidebar" />
        </header>

        <div
          :id="`${uid}-${mod.id}`"
          v-show="!pageSidebar.isCollapsed(mod.id)"
          class="module-panel side-module-body"
        >
          <PersonInfoCard v-if="mod.id === 'profile'" />
          <CheckinPanel v-else-if="mod.id === 'checkin'" class="embedded-checkin" @summary="summaries.checkin = $event" />
          <div v-else-if="mod.id === 'download'" class="app-download">
            <div class="app-left">
              <img src="https://file.fishpi.cn/logo_app.png" width="36" height="36" alt="摸鱼派客户端" />
              <div class="app-text">
                <b>随时随地摸鱼？</b>
                <p>下载摸鱼派客户端，想摸就摸！</p>
              </div>
            </div>
            <button type="button" class="btn green small" @click="goDownload">下载</button>
          </div>
          <BreezemoonFeed v-else-if="mod.id === 'breezemoons'" @summary="summaries.breezemoons = $event" />
          <IncomeModule v-else-if="mod.id === 'income'" />
          <AppearanceModule v-else-if="mod.id === 'appearance'" />
          <AdModule v-else-if="mod.id === 'ad'" />
        </div>
      </section>

      <div v-if="!renderedModules.length" class="empty-side empty-configure">
        <span>暂未开启内页侧栏模块</span>
        <SidebarConfigureButton section="pageSidebar" />
      </div>
    </template>
  </aside>
</template>

<style scoped>
.sidebar-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.side-module-card {
  margin-bottom: 0;
  border-radius: var(--fp-panel-radius, 10px);
  box-shadow: var(--fp-card-shadow);
  overflow: hidden;
}

.side-module-head {
  padding: 0;
  gap: 0;
}

.side-module-card.is-collapsed .side-module-head {
  border-bottom-color: transparent;
}

.more-link {
  flex: none;
  font-size: 12px;
  color: var(--fp-muted);
  text-decoration: none;
  padding: 2px 4px;
  margin-right: 10px;
  border-radius: 4px;
}

.more-link:hover {
  color: var(--fp-link);
  background: var(--fp-hover);
  text-decoration: none;
}

.side-module-body {
  padding: 10px 12px;
}

.embedded-checkin {
  margin-bottom: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
}

.embedded-checkin :deep(.checkin-head h3) {
  display: none;
}

.embedded-checkin :deep(.checkin-head) {
  justify-content: flex-end;
  margin-bottom: 2px;
}

.app-download {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.app-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.app-left img {
  border-radius: 8px;
  flex-shrink: 0;
}

.app-text b {
  display: block;
  font-size: 13px;
  color: var(--fp-title);
}

.app-text p {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--fp-muted);
}

.empty-side {
  margin: 0;
  padding: 16px;
  border: 1px dashed var(--fp-border);
  border-radius: var(--fp-radius-lg, 10px);
  color: var(--fp-muted);
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}

.empty-configure {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 46px;
  padding: 0 0 0 14px;
}
</style>
