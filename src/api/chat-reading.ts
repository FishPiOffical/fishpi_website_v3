import {getApiMode} from './mode'
import {chatMessageDetail,chatMessageContext,chatMessagePage} from './v3-chat-messages'
import {legacyChatSource,legacyChatContext,legacyChatWindow} from './legacy/chat'
/** Mode selects the transport; v3 never retries against a legacy resource. */
export const readChatSource=(id:string,signal?:AbortSignal)=>getApiMode()==='v1'?legacyChatSource(id,signal):chatMessageDetail(id,signal)
export const readChatContext=(id:string,signal?:AbortSignal)=>getApiMode()==='v1'?legacyChatContext(id,signal):chatMessageContext(id,signal)
export const readChatWindow=(options:{before?:string;after?:string;size?:number},signal?:AbortSignal)=>getApiMode()==='v1'?legacyChatWindow(options,signal):chatMessagePage(options,signal)
