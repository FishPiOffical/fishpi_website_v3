<script setup lang="ts">
import {onMounted,ref,watch} from 'vue'
import {RouterLink} from 'vue-router'
import {usePageSeo} from '@/composables/usePageSeo'
import type {FishGame} from '@/api/v3-fish-games'
import {getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useFishGames} from '@/composables/useFishGames'
import {useV3FishGamesStore} from '@/stores/v3FishGames'
import FishGameEditor from '@/components/FishGameEditor.vue'
usePageSeo(()=>({title:'游戏 / 鱼游',path:'/games',description:'摸鱼派游戏与社区鱼游'}))
const auth=useAuthStore(),store=useV3FishGamesStore(),feed=useFishGames(),{sort,selected}=feed,editing=ref<FishGame|null>(null),comment=ref(''),submitted=ref(''),mounted=ref(false)
const {value:games,loading:listLoading,error:listError,page:listPage}=feed.list,{value:game,loading:detailLoading,error:detailError}=feed.detail,{value:comments,loading:commentsLoading,error:commentsError,page:commentsPage}=feed.comments
watch([selected,()=>auth.account?.oId,()=>!!auth.accessToken,()=>getAuthContextVersion()],()=>{editing.value=null;comment.value='';submitted.value=''}, {flush:'sync'})
watch(()=>store.completed,c=>{if(c?.kind==='comment'&&c.id===selected.value&&c.content===submitted.value&&comment.value===submitted.value){comment.value='';submitted.value=''}})
async function sendComment(){if(!game.value||store.pending||store.busy)return;submitted.value=comment.value;await store.comment(game.value.id,comment.value)}
onMounted(()=>{mounted.value=true})
const official = [
  { href: '/games/adarkroom/', title: 'A Dark Room', tip: '黑暗房间' },
  { href: '/games/lifeRestart/view/', title: '人生重开', tip: '模拟器' },
  { href: '/games/emojiPair', title: 'Emoji Pair', tip: '表情配对' },
  { href: '/games/evolve/', title: 'Evolve', tip: '进化' },
  { href: '/games/handle/', title: 'Handle', tip: '摸鱼小玩法' },
]

const activities = [
  { href: '/activity/eating-snake', title: '贪吃蛇', tip: '积分开局' },
  { href: '/activity/gobang', title: '五子棋', tip: '对战' },
  { href: '/activity/catch-the-cat', title: '围住小猫', tip: '益智' },
  { href: '/activity/daxigua', title: '合成大西瓜', tip: '休闲' },
  { href: '/activity/character', title: '写字', tip: '认字活动' },
]

</script>
<template><div class="page">
<section class="card"><h1>游戏 / 鱼游</h1><p class="hint">官方小游戏在经典站点运行，使用该站点登录状态。社区鱼游在下方浏览和投稿。</p></section>
<section v-for="section in [{title:'官方游戏',items:official},{title:'活动小游戏',items:activities}]" :key="section.title" class="card"><h2>{{ section.title }}</h2><ul class="grid"><li v-for="g in section.items" :key="g.href"><a class="game" :href="g.href"><strong>{{ g.title }}</strong><span>{{ g.tip }}</span></a></li></ul><RouterLink v-if="section.title==='活动小游戏'" to="/activity">签到与昨日活跃</RouterLink></section>
<section class="card"><h2>社区鱼游</h2><label>排序<select v-model="sort"><option value="votes">总投票数优先</option><option value="likes">点赞数优先</option></select></label><button type="button" class="refresh-games-btn" :disabled="listLoading" @click="feed.loadList()">刷新鱼游</button><p v-if="listLoading" role="status">正在读取鱼游…</p><p v-if="listError" class="err" role="alert">{{ listError }} <button type="button" @click="feed.loadList()">重试列表</button></p><ul v-if="games" class="game-list"><li v-for="g in games.list" :key="g.id"><button type="button" @click="feed.select(g.id)">{{ g.name }}</button><p>{{ g.description }}</p><p>赞 {{ g.upCount }} · 踩 {{ g.downCount }}</p></li></ul><p v-if="games&&!games.list.length">本页没有鱼游。</p><div v-if="games" class="pager"><span>第{{ games.p }}页 / {{ games.pageCount }}页，共{{ games.total }}个</span><button type="button" :disabled="listLoading||games.p<=1" @click="feed.loadList(games.p-1)">上一页鱼游</button><button type="button" :disabled="listLoading||games.p>=games.pageCount" @click="feed.loadList(games.p+1)">下一页鱼游</button></div><button v-if="listError&&listPage>1" type="button" @click="feed.loadList(listPage-1)">返回上一页</button></section>
<section v-if="selected" class="card"><button type="button" @click="selected=''">关闭详情</button><p v-if="detailLoading">正在读取详情…</p><p v-if="detailError" class="err" role="alert">{{ detailError }} <button type="button" @click="feed.loadDetail()">重试详情</button></p><template v-if="game"><h2>{{ game.name }}</h2><img v-if="game.iconURL" :src="game.iconURL" alt="" class="game-icon" referrerpolicy="no-referrer"/><p>{{ game.description }}</p><p><RouterLink v-if="game.author.id&&game.author.userName" :to="'/member/'+encodeURIComponent(game.author.userName)">{{ game.author.userNickname||game.author.userName }}</RouterLink><span v-else>作者未展示</span></p><a v-if="game.url" :href="game.url" target="_blank" rel="noopener noreferrer">打开游戏</a><p>赞 {{ game.upCount }} · 踩 {{ game.downCount }}</p><div v-if="mounted&&auth.accessToken"><button type="button" :aria-pressed="game.userVote==='like'" :disabled="store.busy||!!store.pending" @click="store.vote(game.id,'like')">点赞</button><button type="button" :aria-pressed="game.userVote==='dislike'" :disabled="store.busy||!!store.pending" @click="store.vote(game.id,'dislike')">点踩</button><button type="button" :disabled="store.busy||!!store.pending||!game.userVote" @click="store.vote(game.id,'')">清除投票</button><button v-if="game.author.id===auth.account?.oId" type="button" @click="editing=game">申请编辑</button></div></template><FishGameEditor v-if="editing&&editing.author.id===auth.account?.oId" :game="editing" @close="editing=null"/>
<h2>评论</h2><p v-if="commentsLoading">正在读取评论…</p><p v-if="commentsError" class="err" role="alert">{{ commentsError }} <button type="button" @click="feed.loadComments()">重试评论</button></p><ul v-if="comments" class="game-list"><li v-for="c in comments.list" :key="c.id"><RouterLink v-if="c.author.id&&c.author.userName" :to="'/member/'+encodeURIComponent(c.author.userName)">{{ c.author.userNickname||c.author.userName }}</RouterLink><p>{{ c.contentAvailable?c.content:'正文不可展示' }}</p></li></ul><p v-if="comments&&!comments.list.length">暂无评论。</p><div v-if="comments" class="pager"><span>第{{ comments.p }}页 / {{ comments.pageCount }}页，共{{ comments.total }}条</span><button type="button" :disabled="commentsLoading||comments.p<=1" @click="feed.loadComments(comments.p-1)">上一页评论</button><button type="button" :disabled="commentsLoading||comments.p>=comments.pageCount" @click="feed.loadComments(comments.p+1)">下一页评论</button></div><button v-if="commentsError&&commentsPage>1" type="button" @click="feed.loadComments(commentsPage-1)">返回上一页评论</button><form v-if="mounted&&auth.accessToken&&game" class="form" @submit.prevent="sendComment"><label>发表评论<textarea v-model="comment" maxlength="8192" required :disabled="store.busy||!!store.pending"/></label><p class="hint">去除HTML和首尾空白后1至500字符。</p><button type="submit" :disabled="store.busy||!!store.pending||!comment.trim()">发送评论</button></form></section>
<section class="card"><FishGameEditor/><p v-if="mounted&&!auth.accessToken"><RouterLink to="/login?redirect=/games">登录</RouterLink>后可投稿、投票和评论。</p></section></div></template>
<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 860px;
  margin: 0 auto;
}
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 18px 20px;
}
h1,
h2 {
  margin: 0 0 10px;
  font-size: 18px;
  color: var(--fp-title);
}
h2 {
  font-size: 16px;
}
.hint {
  margin: 0 0 10px;
  color: var(--fp-muted);
  font-size: 13px;
  line-height: 1.5;
}
.hint a {
  color: var(--fp-link);
}
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}
.game {
  width: 100%;
  box-sizing: border-box;
  text-decoration: none;
  text-align: left;
  border: 1px solid var(--fp-border);
  background: var(--fp-bg);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  color: var(--fp-text);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.game:hover {
  border-color: var(--fp-primary);
}
.game strong {
  font-size: 14px;
}
.game span {
  font-size: 12px;
  color: var(--fp-muted);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--fp-muted);
}
input,
textarea {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 6px;
  padding: 8px 10px;
}
.primary {
  align-self: flex-start;
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
}
.err {
  color: #e07a5f;
  font-size: 13px;
  margin: 0;
}
.ok {
  color: var(--fp-green, #3d8b6e);
  font-size: 13px;
  margin: 0;
}
.game-icon{width:64px;height:64px;object-fit:contain}.refresh-games-btn{display:none}.game-list{list-style:none;padding:0;overflow-wrap:anywhere}.game-list li{padding:10px 0;border-bottom:1px solid var(--fp-border)}.pager{display:flex;flex-wrap:wrap;align-items:center;gap:8px}button,select{font:inherit;padding:6px;margin:3px;background:var(--fp-bg);color:var(--fp-text);border:1px solid var(--fp-border);border-radius:5px}p{overflow-wrap:anywhere}
</style>
