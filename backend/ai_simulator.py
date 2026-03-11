from pydantic import BaseModel
from typing import List, Dict, Optional, Tuple
import copy

# 定数はbattle.pyと同じものを使用
MAX_HP = 60
MAX_RANK = 6
MIN_RANK = -6
FOOD_LIMIT = 6
MEDICAL_LIMIT = 5
FOOD_RECOVERY_AMOUNT = 20
MEDICAL_RECOVERY_AMOUNT = 40
VIOLENCE_ATTACK_DROP = 2
CRITICAL_HIT_CHANCE = 0.125
CRITICAL_HIT_MULTIPLIER = 1.5
BASE_DAMAGE_NORMAL = 7.0
BASE_DAMAGE_TYPED = 10.0
DAMAGE_RANDOM_MIN = 0.85
DAMAGE_RANDOM_MAX = 0.99
LEECH_SEED_TURNS = 4
LEECH_SEED_DRAIN_AMOUNT = 5

class SimPlayer(BaseModel):
    id: str
    hp: int
    attack_rank: int
    defense_rank: int
    types: List[str]
    ability: str
    ability_change_count: int
    food_count: int
    medical_count: int
    poison_turns: int
    leech_turns: int

    @property
    def is_defeated(self) -> bool:
        return self.hp <= 0

class SimState(BaseModel):
    """シミュレーション用の軽量な状態クラス"""
    player1: SimPlayer
    player2: SimPlayer
    player1_turn: bool
    character: str # 次の頭文字
    # ターン経過による勝敗。Noneなら未決着、Trueならplayer1勝利、Falseならplayer2勝利
    player1_win: Optional[bool] 
    used_words: List[str] # 最低限の重複判定用
    
    # AIの推理用データ (直前の相手の行動結果)
    last_turn_damage: int = 0
    last_turn_word_length: int = 0

class BattleSimulator:
    """
    副作用を持たずに盤面をシミュレーションするクラス。
    battle.py のロジックの一部を再実装することで、軽量に何手先も読めるようにする。
    """
    def __init__(self, sb_info_instance, abilities_dict):
        self.sb_info = sb_info_instance
        self.abilities = abilities_dict # battle.get_default_abilities()
    
    def simulate_move(self, state: SimState, word: str) -> SimState:
        """
        現在の状態において `word` を使った後の新しい状態を返す。
        元の状態は変更しない (副作用なし)。
        """
        new_state = state.model_copy(deep=True)
        
        # 終了判定
        if new_state.player1_win is not None:
            return new_state
            
        new_state.used_words.append(word)
        types = self._get_types(word)
        original_types = types[:]
        
        attacker = new_state.player1 if new_state.player1_turn else new_state.player2
        defender = new_state.player2 if new_state.player1_turn else new_state.player1
        
        ability_obj = self.abilities.get(attacker.ability)
        defender_ability_obj = self.abilities.get(defender.ability)
        
        # 後の判定のために変数を初期化
        damage = 0.0
        
        # 特殊処理（いしょくどうげん等）
        if ability_obj and ability_obj.name == "いしょくどうげん" and "食べ物" in types:
            types.remove("食べ物")
            if "医療" not in types:
                types.append("医療")
                
        # ダメージ代替特性（やどりぎ、ステータスアップなど）
        if ability_obj and getattr(ability_obj, 'replaces_damage', False) and self._check_condition(ability_obj, attacker, types, word):
            attacker.types = original_types[:]
            self._apply_damage_replacement(ability_obj, attacker, defender)
            self._process_end_of_turn(new_state, attacker, defender)
            
            new_state.last_turn_word_length = len(word)
            new_state.last_turn_damage = 0
            
            new_state.character = self.sb_info.get_next_initial(word)
            new_state.player1_turn = not new_state.player1_turn
            return new_state

        # 通常攻撃・回復処理
        original_attack_rank = attacker.attack_rank
        ability_activated = False
        if ability_obj and not getattr(ability_obj, 'replaces_damage', False) and self._check_condition(ability_obj, attacker, types, word):
            ability_activated = self._apply_effect(ability_obj, attacker)
            
        attacker.types = original_types[:]
        
        # 食べ物・医療
        if "食べ物" in types:
            ignore_limit = ability_obj and hasattr(ability_obj, 'should_ignore_food_limit') and ability_obj.should_ignore_food_limit()
            if ignore_limit or attacker.food_count < FOOD_LIMIT:
                attacker.food_count += 1
                cure = FOOD_RECOVERY_AMOUNT
                if ability_obj and hasattr(ability_obj, 'get_food_recovery_amount'):
                    cure = ability_obj.get_food_recovery_amount(cure)
                attacker.hp = min(MAX_HP, attacker.hp + cure)
        elif "医療" in types:
            if attacker.medical_count < MEDICAL_LIMIT:
                attacker.medical_count += 1
                attacker.poison_turns = 0
                attacker.hp = min(MAX_HP, attacker.hp + MEDICAL_RECOVERY_AMOUNT)
        else:
            # ダメージ計算 (確率的な急所と乱数は平均値でシミュレーション)
            at1 = types[0] if len(types) >= 1 else ""
            at2 = types[1] if len(types) >= 2 else ""
            dt1 = defender.types[0] if len(defender.types) >= 1 else ""
            dt2 = defender.types[1] if len(defender.types) >= 2 else ""
            
            e = self.sb_info.type_effect(at1, at2, dt1, dt2)
            
            # 平均的な乱数 (0.92) を使用
            avg_random = (DAMAGE_RANDOM_MIN + DAMAGE_RANDOM_MAX) / 2.0
            
            # 安定した予測のため、急所確率は期待値としてダメージに上乗せする簡易計算
            # 確定急所特性チェック
            force_crit = ability_obj and hasattr(ability_obj, 'should_force_critical') and ability_obj.should_force_critical([at1, at2])
            crit_chance = 1.0 if force_crit else (CRITICAL_HIT_CHANCE if "暴言" in [at1, at2] or "人体" in [at1, at2] else 0.0)
            expected_crit_multiplier = 1.0 + (crit_chance * (CRITICAL_HIT_MULTIPLIER - 1.0))

            atk_pow = self.sb_info.rank_to_power(attacker.attack_rank)
            def_pow = self.sb_info.rank_to_power(defender.defense_rank)
            rank_correction = atk_pow / def_pow

            # 確定急所なら不利ランク無視
            if force_crit: rank_correction = max(1.0, rank_correction)

            damage = 0.0
            if at1 == at2 == "":
                damage = BASE_DAMAGE_NORMAL * rank_correction
            elif dt1 == dt2 == "":
                damage = BASE_DAMAGE_TYPED * e * rank_correction
            else:
                damage = BASE_DAMAGE_TYPED * e * rank_correction * avg_random
            
            damage = int(damage * expected_crit_multiplier)
            
            # 特性倍率
            if ability_obj and hasattr(ability_obj, 'get_damage_multiplier'):
                 damage = int(damage * ability_obj.get_damage_multiplier(types, word))

            # 防御側特性
            if defender_ability_obj and defender_ability_obj.name == "ほけん" and e > 1:
                 defender.attack_rank = min(MAX_RANK, defender.attack_rank + 3)

            # 暴力タイプ
            if "暴力" in types:
                drop = VIOLENCE_ATTACK_DROP
                if ability_obj and hasattr(ability_obj, 'get_violence_penalty_reduction'):
                    drop -= ability_obj.get_violence_penalty_reduction()
                attacker.attack_rank = max(MIN_RANK, attacker.attack_rank - drop)

            defender.hp = max(0, defender.hp - damage)
            if defender.is_defeated:
                new_state.player1_win = new_state.player1_turn

        if ability_activated:
            attacker.attack_rank = original_attack_rank

        # ダメージ後特性効果 (どくばり等)
        if ability_obj and not getattr(ability_obj, 'replaces_damage', False) and self._check_condition(ability_obj, attacker, types, word):
            self._apply_after_effect(ability_obj, attacker, defender)

        # 全体処理
        self._process_end_of_turn(new_state, attacker, defender)
        
        # 推理情報の保存
        new_state.last_turn_word_length = len(word)
        new_state.last_turn_damage = damage if not getattr(ability_obj, 'replaces_damage', False) and "食べ物" not in types and "医療" not in types else 0
        
        new_state.character = self.sb_info.get_next_initial(word)
        new_state.player1_turn = not new_state.player1_turn

        return new_state

    # ==========================================
    # 以降はシミュレート用のヘルパーメソッド群
    # ==========================================
    def _get_types(self, word: str) -> List[str]:
        if self.sb_info.inclue_in_typed_words(word):
            return [t for t in self.sb_info.get_types(word) if t]
        return [""]

    def _check_condition(self, ability_obj, player: SimPlayer, types: List[str], word: str) -> bool:
        """特性の簡略化された発動チェック"""
        if hasattr(ability_obj, 'target_type'):
            return ability_obj.target_type in types
        if ability_obj.name == "やどりぎ":
            return "植物" in types and player.leech_turns == 0
        if ability_obj.name in ["どくばり", "いかく", "たいふういっか", "かくめい"]:
            target = {"どくばり": "虫", "いかく": "動物", "たいふういっか": "天気", "かくめい": "遊び"}
            return target[ability_obj.name] in types
        if ability_obj.name == "からて": return "人体" in types
        if ability_obj.name == "ずぼし": return "暴言" in types
        return False
        
    def _apply_damage_replacement(self, ability_obj, attacker: SimPlayer, defender: SimPlayer):
        if hasattr(ability_obj, 'boost_amount'):
            if getattr(ability_obj, 'stat_type', 'attack') == 'defense':
                attacker.defense_rank = min(MAX_RANK, attacker.defense_rank + ability_obj.boost_amount)
            else:
                attacker.attack_rank = min(MAX_RANK, attacker.attack_rank + ability_obj.boost_amount)
        elif ability_obj.name == "やどりぎ":
            attacker.leech_turns = LEECH_SEED_TURNS
        elif ability_obj.name == "いかく":
            defender.attack_rank = max(MIN_RANK, defender.attack_rank - 1)

    def _apply_effect(self, ability_obj, attacker: SimPlayer) -> bool:
        if ability_obj.name == "ロックンロール" or ability_obj.name == "情熱" or ability_obj.name == "トレーニング" or ability_obj.name == "計算":
             # 実行時アップ（元に戻す）はここでは簡易化し無視（本来のロジックではダメージ計算時のみ上がる）
             return True
        return False

    def _apply_after_effect(self, ability_obj, attacker: SimPlayer, defender: SimPlayer):
        if ability_obj.name == "どくばり":
             if defender.poison_turns == 0: defender.poison_turns = 1
        elif ability_obj.name == "かくめい":
             attacker.attack_rank *= -1
             attacker.defense_rank *= -1
             defender.attack_rank *= -1
             defender.defense_rank *= -1
        elif ability_obj.name == "たいふういっか":
             attacker.attack_rank = 0
             attacker.defense_rank = 0
             defender.attack_rank = 0
             defender.defense_rank = 0

    def _process_end_of_turn(self, state: SimState, attacker: SimPlayer, defender: SimPlayer):
        if state.player1_win is not None: return

        for p in [state.player1, state.player2]:
            if not p.is_defeated and p.poison_turns > 0:
                damage = int(MAX_HP * (p.poison_turns / 16))
                p.hp = max(0, p.hp - damage)
                p.poison_turns += 1
                if p.is_defeated:
                    state.player1_win = (p.id != state.player1.id)

        if attacker.leech_turns > 0:
            if not defender.is_defeated:
                drain = min(defender.hp, LEECH_SEED_DRAIN_AMOUNT)
                defender.hp = max(0, defender.hp - drain)
                attacker.hp = min(MAX_HP, attacker.hp + drain)
                attacker.leech_turns -= 1
                if defender.is_defeated:
                    state.player1_win = (attacker.id == state.player1.id)
            else:
                attacker.leech_turns = 0
