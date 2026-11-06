import {onMounted,onScopeDispose,ref,watch,type Ref} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {fetchCityUsers,fetchCityArticles,type CityPage,type CityUser,type CitySort} from '@/api/v3-cities'
import type {ArticleSummary} from '@/api/fishpi'
import {useAuthStore} from '@/stores/auth'
export function useCityFeed(city:Ref<string>){
 const auth=useAuthStore(),sort=ref<CitySort>('latest');let mounted=false
 function resource<T>(fetch:(p:number)=>Promise<CityPage<T>>){const value=ref<CityPage<T>|null>(null),loading=ref(false),error=ref(''),p=ref(1);let sequence=0
 function clear(){sequence++;value.value=null;loading.value=false;error.value=''}
 async function read(next=p.value){if(!mounted||import.meta.env.SSR)return;clear();p.value=next;const run=sequence,boundary=getAuthContextVersion(),target=city.value,token=auth.accessToken,owner=auth.account?.oId;const valid=()=>mounted&&run===sequence&&target===city.value&&boundary===getAuthContextVersion()&&token===auth.accessToken&&owner===auth.account?.oId;loading.value=true;try{const data=await fetch(next);if(valid())value.value=data}catch(e){if(valid())error.value=e instanceof Error?e.message:'同城读取失败'}finally{if(valid())loading.value=false}}
 return{value,loading,error,p,read,clear}}
 const users=resource<CityUser>(p=>fetchCityUsers(city.value,p)),articles=resource<ArticleSummary>(p=>fetchCityArticles(city.value,p,sort.value))
 const stops=[watch(city,()=>{users.clear();articles.clear();users.p.value=articles.p.value=1;void users.read();void articles.read()},{flush:'sync'}),watch(sort,()=>void articles.read(1)),watch([()=>auth.accessToken,()=>auth.account?.oId],(_,old)=>{const sameOwner=auth.account?.oId===old[1]&&!!auth.accessToken===!!old[0];users.clear();articles.clear();if(!sameOwner)users.p.value=articles.p.value=1;void users.read();void articles.read()},{flush:'sync'})]
 onMounted(()=>{mounted=true;void users.read();void articles.read()});onScopeDispose(()=>{mounted=false;stops.forEach(stop=>stop());users.clear();articles.clear()})
 return{users,articles,sort}
}
