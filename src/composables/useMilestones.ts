import {onMounted,onScopeDispose,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {getMilestone,listMilestones,decodeMilestoneInitial,type Milestone,type MilestoneFilter,type MilestonePage} from '@/api/v3-milestones'
import {useAuthStore} from '@/stores/auth'
import {useV3MilestonesStore} from '@/stores/v3Milestones'
export function useMilestones(initial:MilestonePage|null){
 const auth=useAuthStore(),writes=useV3MilestonesStore(),scope=ref<'public'|'owned'>('public'),filter=ref<MilestoneFilter>('all'),selected=ref('');let mounted=false
 function resource<T>(){const value=ref<T|null>(null),loading=ref(false),error=ref(''),p=ref(1);let sequence=0
 function clear(){sequence++;value.value=null;loading.value=false;error.value=''}
 async function read(fetch:()=>Promise<T>){if(!mounted||import.meta.env.SSR)return;clear();const run=sequence,boundary=getAuthContextVersion(),token=auth.accessToken,owner=auth.account?.oId,view=scope.value;loading.value=true;const valid=()=>mounted&&run===sequence&&boundary===getAuthContextVersion()&&token===auth.accessToken&&owner===auth.account?.oId&&view===scope.value;try{const result=await fetch();if(valid())value.value=result}catch(e){if(valid())error.value=e instanceof Error?e.message:'大事记读取失败'}finally{if(valid())loading.value=false}}
 return{value,loading,error,p,clear,read}}
 const list=resource<MilestonePage>(),detail=resource<Milestone>();let hydrated=false;try{if(initial){list.value.value=decodeMilestoneInitial(initial);hydrated=true}}catch{list.value.value=null}
 function loadList(p=list.p.value){list.p.value=p;if(scope.value==='owned'&&!auth.accessToken){list.clear();return Promise.resolve()}return list.read(()=>listMilestones(p,scope.value==='owned',filter.value))}
 function loadDetail(){if(!selected.value||scope.value==='owned'&&!auth.accessToken){detail.clear();return Promise.resolve()}return detail.read(()=>getMilestone(selected.value,scope.value==='owned'))}
 function openOwned(id=''){if(!auth.accessToken)return;scope.value='owned';if(selected.value===id&&id)void loadDetail();else selected.value=id}
 const stops=[watch(scope,()=>{selected.value='';detail.clear();void loadList(1)},{flush:'sync'}),watch(filter,()=>{if(scope.value==='owned')void loadList(1)}),watch(selected,()=>{detail.clear();if(selected.value)void loadDetail()},{flush:'sync'}),watch([()=>auth.accessToken,()=>auth.account?.oId],(_,old)=>{list.clear();detail.clear();if(!auth.accessToken||auth.account?.oId!==old[1]){selected.value='';scope.value='public';list.p.value=1}void loadList();void loadDetail()},{flush:'sync'}),watch(()=>writes.revision,()=>{if(scope.value==='owned'){void loadList(1);void loadDetail()}})]
 onMounted(()=>{mounted=true;if(auth.accessToken||!hydrated)void loadList();if(selected.value)void loadDetail()});onScopeDispose(()=>{mounted=false;stops.forEach(s=>s());list.clear();detail.clear()})
 return{scope,filter,selected,list,detail,loadList,loadDetail,openOwned}
}
