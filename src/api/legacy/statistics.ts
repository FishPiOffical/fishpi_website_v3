import {ApiError,request} from '../http'
import {decodeStatistics,type CommunityStatistics} from '../v3-statistics'
import {legacyObject} from './home'
const fields={memberCount:'statisticMemberCount',articleCount:'statisticArticleCount',commentCount:'statisticCmtCount',domainCount:'statisticDomainCount',tagCount:'statisticTagCount',linkCount:'statisticLinkCount',onlineVisitorCount:'onlineVisitorCnt',onlineMemberCount:'onlineMemberCnt',peakOnlineVisitorCount:'statisticMaxOnlineVisitorCount'} as const
export async function legacyStatistics():Promise<CommunityStatistics>{const envelope=legacyObject(await request('/api/statistic',{cache:'no-store'}));if(envelope.code!==0)throw new ApiError(typeof envelope.msg==='string'?envelope.msg:'社区统计读取失败',502);const row=legacyObject(envelope.data);return decodeStatistics(Object.fromEntries(Object.entries(fields).map(([key,source])=>[key,row[source]])))}
