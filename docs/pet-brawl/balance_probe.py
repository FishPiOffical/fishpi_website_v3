"""乱斗规则审计；独立种子内交换双方随机序列和先手，平局按半分计。"""

import argparse
import json
import random

CONFIGS = [(weapon, skill) for weapon in range(3) for skill in range(3)]
LABELS = [
    weapon + skill
    for weapon in ('木勺', '护腕', '折扇')
    for skill in ('水花', '卷团', '呼吸')
]
MODES = ('old', 'balanced', 'simultaneous', 'simultaneous_overkill')


def positive_integer(value):
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError('trials 必须为正整数')
    return parsed


def attack(configs, actor, round_no, roll, shields, balanced):
    weapon, skill = configs[actor]
    enemy = 1 - actor
    jitter, critical = roll
    damage = 9 + jitter
    weapon_bonus = 0
    if weapon == 0 and (not balanced or round_no <= 8):
        weapon_bonus = 1
    elif weapon == 2 and round_no in (3, 6):
        weapon_bonus = 4
    skill_bonus = 0
    if skill == 0 and round_no == 4:
        skill_bonus = 8 if balanced else 6
    if not balanced:
        damage += weapon_bonus + skill_bonus
    if critical:
        damage = damage * 3 // 2
    if balanced:
        damage += weapon_bonus + skill_bonus
    if configs[enemy][0] == 1 and round_no <= 2:
        damage -= 4 if balanced else 3
    damage = max(1, damage - shields[enemy])
    shields[enemy] = 0
    return damage


def compare_hp(hp):
    # 此原型最大 HP 均为 100，比较残余值与比较残血比例等价。
    if hp[0] == hp[1]:
        return -1
    return 0 if hp[0] > hp[1] else 1


def fight(left, right, rolls, initiative, mode, swapped):
    configs = (left, right)
    hp = [100, 100]
    shields = [0, 0]
    balanced = mode != 'old'
    simultaneous = mode.startswith('simultaneous')
    first_round = initiative[0] ^ swapped
    for round_no in range(1, 13):
        if mode == 'old':
            first = ((initiative[0] + round_no - 1) % 2) ^ swapped
        else:
            first = initiative[round_no - 1] ^ swapped
        if simultaneous:
            for actor in (0, 1):
                if configs[actor][1] == 2 and round_no == 4:
                    hp[actor] = min(100, hp[actor] + 8)
            damages = [
                attack(configs, actor, round_no, rolls[actor ^ swapped][round_no - 1], shields, balanced)
                for actor in (0, 1)
            ]
            hp[0] -= damages[1]
            hp[1] -= damages[0]
            if min(hp) <= 0:
                if max(hp) <= 0:
                    winner = compare_hp(hp) if mode == 'simultaneous_overkill' else -1
                else:
                    winner = 0 if hp[0] > 0 else 1
                return winner, round_no, first_round
        else:
            for actor in (first, 1 - first):
                if configs[actor][1] == 2 and round_no == 4:
                    hp[actor] = min(100, hp[actor] + 8)
                enemy = 1 - actor
                damage = attack(configs, actor, round_no, rolls[actor ^ swapped][round_no - 1], shields, balanced)
                hp[enemy] -= damage
                if hp[enemy] <= 0:
                    return actor, round_no, first_round
        if round_no == 4:
            for actor in (0, 1):
                if configs[actor][1] == 1:
                    shields[actor] = 8 if balanced else 6
    return compare_hp(hp), 12, first_round


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--trials', type=positive_integer, default=4000)
    parser.add_argument('--seed', type=int, default=20261116)
    parser.add_argument('--modes', nargs='+', choices=MODES, default=list(MODES))
    args = parser.parse_args()
    rng = random.Random(args.seed)
    trials = []
    for _ in range(args.trials):
        rolls = [
            [(rng.randrange(-2, 3), rng.random() < .08) for _ in range(12)]
            for _ in range(2)
        ]
        initiative = [rng.randrange(2) for _ in range(12)]
        trials.append((rolls, initiative))
    battles_per_mode = args.trials * 2 * len(CONFIGS) ** 2
    output = {
        'independent_seeds': args.trials,
        'trials_per_ordered_pair': args.trials * 2,
        'battles_per_mode': battles_per_mode,
        'total_battles': battles_per_mode * len(args.modes),
        'seed': args.seed,
        'note': '配装及交换局共享随机样本；总局数不代表独立统计样本数。',
        'results': {},
    }
    for mode in args.modes:
        rows = []
        for index, config in enumerate(CONFIGS):
            wins = draws = rounds = 0
            mirror_first_wins = mirror_draws = mirror_count = 0
            for opponent in CONFIGS:
                for rolls, initiative in trials:
                    for swapped in (0, 1):
                        winner, turn, first_round = fight(config, opponent, rolls, initiative, mode, swapped)
                        wins += winner == 0
                        draws += winner == -1
                        rounds += turn
                        if config == opponent:
                            mirror_count += 1
                            mirror_first_wins += winner == first_round
                            mirror_draws += winner == -1
            count = len(CONFIGS) * len(trials) * 2
            rows.append({
                'loadout': LABELS[index],
                'battles': count,
                'win_pct': round(wins / count * 100, 3),
                'lose_pct': round((count - wins - draws) / count * 100, 3),
                'win_score_pct': round((wins + draws / 2) / count * 100, 3),
                'draw_pct': round(draws / count * 100, 3),
                'avg_rounds': round(rounds / count, 3),
                'mirror_initial_first_win_pct': round(mirror_first_wins / mirror_count * 100, 3),
                'mirror_draw_pct': round(mirror_draws / mirror_count * 100, 3),
            })
        output['results'][mode] = rows
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
