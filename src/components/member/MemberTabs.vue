<script setup lang="ts">
import { computed, onMounted, ref, nextTick, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
const route=useRoute(), auth=useAuthStore(), mounted=ref(false), nav=ref<HTMLElement|null>(null)
const target=computed(()=>String(route.params.userName||''))
const base=computed(()=>`/member/${encodeURIComponent(target.value)}`)
const self=computed(()=>mounted.value && auth.isLoggedIn && auth.account?.userName===target.value)
const tabs=computed(()=>[
  ['', '帖子'],['long','长文章'],['comments','回帖'],['breezemoons','清风明月'],
  ['following/users','关注用户'],['followers','关注者'],['following/tags','关注标签'],['watching/articles','关注帖子'],['following/articles','收藏帖子'],
  ...(self.value?[['articles/anonymous','匿贴'],['comments/anonymous','匿回'],['points','我的积分']]:[]),
])
function active(path:string) {
  const full=base.value+(path?'/'+path:'')
  return route.path===full || path==='breezemoons' && route.path.startsWith(full+'/')
}
function reveal() { void nextTick(()=>nav.value?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({block:'nearest',inline:'nearest'})) }
onMounted(()=>{mounted.value=true;reveal()})
watch(()=>route.path,reveal)
</script>
<template>
  <section class="member-navigation" aria-label="个人主页导航">
    <nav ref="nav" aria-label="用户主页栏目">
      <RouterLink v-for="tab in tabs" :key="tab[0]" :to="base+(tab[0]?'/'+tab[0]:'')" :class="{selected:active(tab[0]!)}" :aria-current="active(tab[0]!)?'page':undefined">{{ tab[1] }}</RouterLink>
    </nav>
  </section>
</template>
<style scoped>
.member-navigation{margin:0 0 14px;min-width:0;background:var(--fp-card);border:1px solid var(--fp-border);border-radius:var(--fp-panel-radius,10px);box-shadow:var(--fp-card-shadow);padding:14px 16px}
nav{display:flex;flex-wrap:wrap;gap:4px}
nav a{flex:none;padding:7px 11px;border-radius:6px;color:var(--fp-muted);font-size:13px;line-height:1.5;text-decoration:none;white-space:nowrap}
nav a:hover{background:var(--fp-hover);text-decoration:underline;text-underline-offset:3px}
nav a.selected{color:var(--fp-primary);background:var(--fp-primary-soft);font-weight:600}
nav a:focus-visible{outline:2px solid var(--fp-primary);outline-offset:2px}
@media(max-width:640px){.member-navigation{padding:12px;margin-bottom:14px}nav{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;padding-bottom:4px}}
</style>
