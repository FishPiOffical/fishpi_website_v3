import { ApiError, request } from './http';
export const professionModules = [
    ['primaryProfession', '主职业'], ['allProfessions', '全部职业'], ['experience', '经验'], ['rarity', '稀有度'], ['majorContributions', '主要贡献'],
    ['contributionStats', '贡献统计'], ['activityFeed', '活动动态'], ['levelHistory', '等级历史'], ['rewards', '奖励'], ['ranking', '排行'],
] as const;
export const professionScopes = { PUBLIC: '所有人', LOGGED_IN: '登录用户', SELF: '仅自己', HIDDEN: '隐藏' } as const;
export const professionPresets = { ALL_PUBLIC: '全部公开', LEVEL_ONLY: '仅主职业（等级预设）', PRIMARY_ONLY: '仅主职业', SELF_ONLY: '仅自己', FULLY_HIDDEN: '全部隐藏', CUSTOM: '自定义' } as const;
export type Module = typeof professionModules[number][0];
export type Scope = keyof typeof professionScopes;
export type Preset = keyof typeof professionPresets;
export type Visibility = Record<Module, Scope>;
export type Profession = {
    professionId: string;
    professionCode: string;
    displayName: string;
    shortName: string;
    description: string;
};
export type Progress = Profession & {
    state: 'ACTIVE' | 'RETIRED';
    totalExperience: number;
    levelCode: string;
    levelName: string;
    levelDescription?: string;
    requiredExperience: number;
};
export type Selection = {
    onboardingState: 'UNDECIDED' | 'SKIPPED' | 'SELECTED';
    primaryProfessionId: string;
    primaryProfessionState: 'NONE' | 'ACTIVE' | 'RETIRED' | 'DELETED';
    privacyPreset: Preset;
    moduleVisibility: Visibility;
};
export type Page<T> = {
    list: T[];
    pagination: {
        p: number;
        size: number;
        total: number;
        pageCount: number;
    };
};
export type Mine = Page<Progress> & {
    state: Selection;
};
export type ExperienceRecord = {
    actionCode: string;
    experienceDelta: number;
    beforeExperience: number;
    afterExperience: number;
    beforeLevelCode: string;
    afterLevelCode: string;
    occurredAt: number;
};
export type Detail = {
    profession: Progress;
    levels: {
        levelCode: string;
        sortOrder: number;
        requiredExperience: number;
        displayName: string;
        shortName: string;
        description: string;
        achievementDescription: string;
        topLevel: boolean;
    }[];
    contributions: {
        actionCode: string;
        experienceSum: number;
        eventCount: number;
        lastOccurredAt: number;
    }[];
};
type Row = Record<string, unknown>;
const invalid = () => new ApiError('职业响应格式不正确', 502, 'invalid_response');
const row = (v: unknown): Row => { if (!v || typeof v !== 'object' || Array.isArray(v))
    throw invalid(); return v as Row; };
const text = (v: unknown): string => { if (typeof v !== 'string' || v.length > 8192)
    throw invalid(); return v; };
const number = (v: unknown, negative = false): number => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || !negative && v < 0)
    throw invalid(); return v; };
function choice<T extends string>(value: unknown, options: readonly T[]): T { if (typeof value !== 'string' || !options.includes(value as T))
    throw invalid(); return value as T; }
function id(value: unknown): string { const s = text(value); if (!/^[0-9]{1,19}$/.test(s))
    throw invalid(); return s; }
export function visibility(value: unknown): Visibility { const source = row(value), output = {} as Visibility; if (Object.keys(source).length !== professionModules.length)
    throw invalid(); for (const [name] of professionModules)
    output[name] = choice(source[name], Object.keys(professionScopes) as Scope[]); return output; }
function definition(value: unknown): Profession { const v = row(value); return { professionId: id(v.professionId), professionCode: text(v.professionCode), displayName: text(v.displayName), shortName: text(v.shortName), description: text(v.description) }; }
function progress(value: unknown): Progress { const v = row(value); return { ...definition(v), state: choice(v.state, ['ACTIVE', 'RETIRED']), totalExperience: number(v.totalExperience), levelCode: text(v.levelCode), levelName: text(v.levelName), ...(v.levelDescription !== undefined ? { levelDescription: text(v.levelDescription) } : {}), requiredExperience: number(v.requiredExperience) }; }
function selection(value: unknown): Selection { const v = row(value); return { onboardingState: choice(v.onboardingState, ['UNDECIDED', 'SKIPPED', 'SELECTED']), primaryProfessionId: v.primaryProfessionId === '' ? '' : id(v.primaryProfessionId), primaryProfessionState: choice(v.primaryProfessionState, ['NONE', 'ACTIVE', 'RETIRED', 'DELETED']), privacyPreset: choice(v.privacyPreset, Object.keys(professionPresets) as Preset[]), moduleVisibility: visibility(v.moduleVisibility) }; }
async function data(path: string, init?: RequestInit): Promise<Row> { const result = await request<{
    code: number;
    msg?: string;
    data?: unknown;
}>(path, init); if (result.code !== 0)
    throw new ApiError(result.msg || '职业操作失败', 400); return row(result.data); }
function paging(p: number): string { if (!Number.isSafeInteger(p) || p < 1)
    throw new ApiError('页码不合法', 422); return `p=${p}&size=20`; }
function page<T>(value: Row, p: number, project: (value: unknown) => T): Page<T> { const v = row(value.pagination), pagination = { p: number(v.p), size: number(v.size), total: number(v.total), pageCount: number(v.pageCount) }; if (pagination.p !== p || pagination.size !== 20 || pagination.pageCount !== Math.ceil(pagination.total / 20) || !Array.isArray(value.list) || value.list.length > 20)
    throw invalid(); return { list: value.list.map(project), pagination }; }
function unique<T extends Profession>(value: Page<T>): Page<T> { if (new Set(value.list.map(v => v.professionId)).size !== value.list.length)
    throw invalid(); return value; }
export async function fetchV3Professions(p = 1): Promise<Page<Profession>> { return unique(page(await data(`/api/v3/professions?${paging(p)}`), p, definition)); }
export async function fetchV3OwnerProfessions(p = 1): Promise<Mine> { const value = await data(`/api/v3/me/professions?${paging(p)}`); return { ...unique(page(value, p, progress)), state: selection(value.state) }; }
export async function fetchV3ProfessionDetail(professionId: string): Promise<Detail> {
    const value = await data(`/api/v3/me/professions/${id(professionId)}`), profession = progress(value.profession);
    if (profession.professionId !== professionId || !Array.isArray(value.levels) || !Array.isArray(value.contributions) || value.levels.length > 512 || value.contributions.length > 512)
        throw invalid();
    const levels = value.levels.map(x => { const v = row(x); if (typeof v.topLevel !== 'boolean')
        throw invalid(); return { levelCode: text(v.levelCode), sortOrder: number(v.sortOrder, true), requiredExperience: number(v.requiredExperience), displayName: text(v.displayName), shortName: text(v.shortName), description: text(v.description), achievementDescription: text(v.achievementDescription), topLevel: v.topLevel }; });
    if (!levels.length || new Set(levels.map(v => v.levelCode)).size !== levels.length || !levels.some(v => v.levelCode === profession.levelCode))
        throw invalid();
    const contributions = value.contributions.map(x => { const v = row(x); return { actionCode: text(v.actionCode), experienceSum: number(v.experienceSum, true), eventCount: number(v.eventCount), lastOccurredAt: number(v.lastOccurredAt) }; });
    if (new Set(contributions.map(v => v.actionCode)).size !== contributions.length)
        throw invalid();
    return { profession, levels, contributions };
}
export async function fetchV3ProfessionRecords(professionId: string, p = 1): Promise<Page<ExperienceRecord>> {
    return page(await data(`/api/v3/me/professions/${id(professionId)}/records?${paging(p)}`), p, x => { const v = row(x); return { actionCode: text(v.actionCode), experienceDelta: number(v.experienceDelta, true), beforeExperience: number(v.beforeExperience), afterExperience: number(v.afterExperience), beforeLevelCode: text(v.beforeLevelCode), afterLevelCode: text(v.afterLevelCode), occurredAt: number(v.occurredAt) }; });
}
export type ProfessionCommand = {
    kind: 'primary';
    professionId: string;
} | {
    kind: 'skip';
} | {
    kind: 'privacy';
    preset: Preset;
    moduleVisibility?: Visibility;
};
export async function writeV3Profession(command: ProfessionCommand, key: string): Promise<Row> {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(key))
        throw new ApiError('操作标识不合法', 422);
    let resource: string, body: Row;
    if (command.kind === 'primary') {
        resource = 'primary';
        body = { professionId: id(command.professionId) };
    }
    else if (command.kind === 'skip') {
        resource = 'onboarding';
        body = { onboardingState: 'SKIPPED' };
    }
    else {
        resource = 'privacy';
        const preset = choice(command.preset, Object.keys(professionPresets) as Preset[]);
        body = { preset, ...(preset === 'CUSTOM' ? { moduleVisibility: visibility(command.moduleVisibility) } : {}) };
    }
    const result = await data(`/api/v3/me/professions/${resource}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) });
    if (command.kind === 'privacy') {
        const preset = choice(result.privacyPreset, Object.keys(professionPresets) as Preset[]);
        if (preset !== command.preset)
            throw invalid();
        return { privacyPreset: preset, moduleVisibility: visibility(result.moduleVisibility) };
    }
    if (result.onboardingState !== (command.kind === 'skip' ? 'SKIPPED' : 'SELECTED') || result.primaryProfessionId !== (command.kind === 'skip' ? '' : command.professionId))
        throw invalid();
    return { onboardingState: result.onboardingState, primaryProfessionId: result.primaryProfessionId };
}

export const professionTriggers = {
    'long_article.read_settled': '阅读长篇',
    'article.published': '发表文章',
    'comment.published': '发表评论',
    'breezemoon.published': '发布清风明月',
    'repeater.published': '投稿复读机',
    'chatroom.message.published': '聊天室发言',
    'user.online.settled': '在线时长结算',
} as const;
export type ProfessionGuide = {
    professionId: string;
    triggers: { triggerType: keyof typeof professionTriggers }[];
    rewards: ({ rewardType: 'POINT'; amount: number } | { rewardType: 'MEDAL' })[];
};
export type ProfessionRank = {
    rank: number; userName: string; userNickname: string; userAvatarURL: string;
    professionId: string; professionCode: string; professionName: string;
    levelCode: string; levelName: string; totalExperience?: number;
};
export async function fetchV3ProfessionGuide(professionId: string): Promise<ProfessionGuide> {
    const value = await data(`/api/v3/professions/${id(professionId)}/guides`);
    if (value.professionId !== professionId || !Array.isArray(value.triggers) || !Array.isArray(value.rewards) || value.triggers.length > 512 || value.rewards.length > 512) throw invalid();
    const triggers = value.triggers.map(item => ({ triggerType: choice(row(item).triggerType, Object.keys(professionTriggers) as (keyof typeof professionTriggers)[]) }));
    const rewards = value.rewards.map((item): ProfessionGuide['rewards'][number] => {
        const source = row(item), type = choice(source.rewardType, ['POINT', 'MEDAL']);
        if (type === 'MEDAL') return { rewardType: 'MEDAL' };
        const amount = number(source.amount);
        if (amount < 1 || amount > 2147483647) throw invalid();
        return { rewardType: 'POINT', amount };
    });
    return { professionId, triggers, rewards };
}
export async function fetchV3ProfessionRanking(professionId: string, p = 1): Promise<Page<ProfessionRank>> {
    const value = await data(`/api/v3/professions/${id(professionId)}/ranking?${paging(p)}`);
    let index = 0;
    const result = page(value, p, item => {
        const source = row(item), rank = number(source.rank);
        if (id(source.professionId) !== professionId || rank !== (p - 1) * 20 + ++index) throw invalid();
        const userName = text(source.userName);
        if (!userName || userName.length > 255) throw invalid();
        return {
            rank, userName, userNickname: text(source.userNickname), userAvatarURL: text(source.userAvatarURL),
            professionId, professionCode: text(source.professionCode), professionName: text(source.professionName),
            levelCode: text(source.levelCode), levelName: text(source.levelName),
            ...('totalExperience' in source ? { totalExperience: number(source.totalExperience) } : {}),
        };
    });
    if (new Set(result.list.map(item => item.userName)).size !== result.list.length) throw invalid();
    return result;
}
