import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
export const useFeedbackPanelStore = defineStore('feedbackPanel',()=>{
  const open=ref(false)
  const location=reactive({path:'/feedback',fullPath:'/feedback',params:{id:''}})
  function navigate(path:string) {
    const match=/^\/feedback\/([^/]+)$/.exec(path)
    Object.assign(location,{path,fullPath:path,params:{id:match && match[1]!=='new'?decodeURIComponent(match[1]!):''}})
  }
  function show(path='/feedback') {navigate(path);open.value=true}
  function hide() {open.value=false}
  return {open,location,navigate,show,hide}
})
