"""候选规则的成长敏感性审计；固定同配装对手，100 倍整数单位。"""

import argparse
import json
import random

from balance_probe import CONFIGS, LABELS, positive_integer


def bounded_gain(value):
    parsed = int(value)
    if parsed < 0 or parsed > 100:
        raise argparse.ArgumentTypeError('成长百分比必须在 0 至 100 之间')
    return parsed


def fight(config, rolls, initiative, swapped, gain):
    maximum_hp = [10000 * (100 + gain) // 100, 10000]
    hp = maximum_hp.copy()
    shields = [0, 0]
    for round_no in range(1, 13):
        first = initiative[round_no - 1] ^ swapped
        for actor in (first, 1 - first):
            enemy = 1 - actor
            weapon, skill = config
            if skill == 2 and round_no == 4:
                hp[actor] = min(maximum_hp[actor], hp[actor] + 800)
            jitter, critical = rolls[actor ^ swapped][round_no - 1]
            actor_gain = gain if actor == 0 else 0
            damage = 900 * (100 + actor_gain) // 100 + jitter * 100
            if critical:
                damage = damage * 3 // 2
            if weapon == 0 and round_no <= 8:
                damage += 100
            elif weapon == 2 and round_no in (3, 6):
                damage += 400
            if skill == 0 and round_no == 4:
                damage += 800
            if weapon == 1 and round_no <= 2:
                damage -= 400
            damage = max(100, damage - shields[enemy])
            shields[enemy] = 0
            hp[enemy] -= damage
            if hp[enemy] <= 0:
                return actor
        if round_no == 4 and config[1] == 1:
            shields = [800, 800]
    # 回合用尽时按剩余 HP 比例判定，用整数交叉相乘避免浮点误差。
    left_remaining = hp[0] * maximum_hp[1]
    right_remaining = hp[1] * maximum_hp[0]
    if left_remaining == right_remaining:
        return -1
    return 0 if left_remaining > right_remaining else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--trials', type=positive_integer, default=10000)
    parser.add_argument('--seed', type=int, default=20261116)
    parser.add_argument('--gains', nargs='+', type=bounded_gain, default=[0, 1, 2, 3, 5, 10, 15])
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
    output = {
        'seed': args.seed,
        'independent_seeds': args.trials,
        'trials_per_config': args.trials * 2,
        'total_battles': args.trials * 2 * len(CONFIGS) * len(args.gains),
        'growth': '一方最大 HP 和基础攻击同时增加指定百分比，固定附加伤害和治疗量保持相同。',
        'note': '配装及交换局共享随机样本；总局数不代表独立统计样本数。',
        'results': {},
    }
    for gain in args.gains:
        rows = []
        for index, config in enumerate(CONFIGS):
            wins = draws = 0
            for rolls, initiative in trials:
                for swapped in (0, 1):
                    winner = fight(config, rolls, initiative, swapped, gain)
                    wins += winner == 0
                    draws += winner == -1
            count = args.trials * 2
            rows.append({
                'loadout': LABELS[index],
                'battles': count,
                'win_pct': round(wins / count * 100, 3),
                'lose_pct': round((count - wins - draws) / count * 100, 3),
                'win_score_pct': round((wins + .5 * draws) / count * 100, 3),
                'draw_pct': round(draws / count * 100, 3),
            })
        output['results'][str(gain)] = rows
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
