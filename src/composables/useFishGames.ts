import {onMounted,onScopeDispose,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {listFishGames,getFishGame,listGameComments,type FishGame,type GameComment,type GamePage} from '@/api/v3-fish-games'
import {useAuthStore} from '@/stores/auth'
import {useV3FishGamesStore} from '@/stores/v3FishGames'
export function useFishGames(){
 const auth=useAuthStore(),writes=useV3FishGamesStore(),sort=ref<'votes'|'likes'>('votes'),selected=ref('')
 const list=resource<GamePage<FishGame>>(),detail=resource<FishGame>(),comments=resource<GamePage<GameComment>>()
 let mounted=false
 function resource<T>(){const value=ref<T|null>(null),loading=ref(false),error=ref(''),page=ref(1);let seq=0
 function clear(){seq++;value.value=null;loading.value=false;error.value=''}
 async function read(fetch:()=>Promise<T>){if(!mounted||import.meta.env.SSR)return;clear();const run=seq,boundary=getAuthContextVersion(),owner=auth.account?.oId,token=auth.accessToken;loading.value=true;const valid=()=>mounted&&run===seq&&boundary===getAuthContextVersion()&&owner===auth.account?.oId&&token===auth.accessToken;try{const result=await fetch();if(valid())value.value=result}catch(e){if(valid())error.value=e instanceof Error?e.message:'鱼游读取失败'}finally{if(valid())loading.value=false}}
 return{value,loading,error,page,clear,read}}
 function loadList(p=list.page.value){list.page.value=p;return list.read(()=>listFishGames(p,sort.value))}
 function loadComments(p=comments.page.value){comments.page.value=p;const target=selected.value;if(!target){comments.clear();return Promise.resolve()}return comments.read(()=>listGameComments(target,p))}
 function loadDetail(){const target=selected.value;if(!target){detail.clear();return Promise.resolve()}return detail.read(()=>getFishGame(target))}
 function select(id:string){if(selected.value===id){void loadDetail();void loadComments(1)}else selected.value=id}
 const stops=[watch(sort,()=>void loadList(1)),watch(selected,()=>{detail.clear();comments.clear();if(selected.value){void loadDetail();void loadComments(1)}}),watch([()=>auth.accessToken,()=>auth.account?.oId],()=>{list.clear();detail.clear();comments.clear();if(mounted){void loadList();void loadDetail();void loadComments()}},{flush:'sync'}),watch(()=>writes.revision,()=>{if(mounted){void loadList();void loadDetail();void loadComments(writes.completed?.kind==='comment'?1:comments.page.value)}})]
 onMounted(()=>{mounted=true;void loadList()});onScopeDispose(()=>{mounted=false;stops.forEach(s=>s());list.clear();detail.clear();comments.clear()})
 return{sort,selected,list,detail,comments,loadList,loadDetail,loadComments,select}
}
