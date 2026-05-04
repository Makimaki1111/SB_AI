try:
    from player import Player
    from SB_info import SB_info
    from abilities import Ability, get_default_abilities
    from constants import *
    from schemas import BattleResponse, BattleState, CharacterState, BattleEvent
except ImportError:
    from backend.player import Player
    from backend.SB_info import SB_info
    from backend.abilities import Ability, get_default_abilities
    from backend.constants import *
    from backend.schemas import BattleResponse, BattleState, CharacterState, BattleEvent

import random
import uuid
from collections import defaultdict

class BaseBattle:
    """
    シングルバトルとダブルバトルの共通ロジックを管理する基底クラス
    """
    def __init__(self, sb_info: SB_info, room_id: str = None):
        self.room_id = room_id or str(uuid.uuid4())
        self.sb_info = sb_info
        self.used = defaultdict(list)
        self.events = []
        self.turn = 1
        self.word = ""
        self.character = ""
        self.players = [] 
        self.START_CHARACTERS = "あいうえおかきくけこさしすせそたちつてとなにねのはひふへほまみむめやゆよらりるれろわ"
        self.winner_team = None 
        self.last_actor_id = None
        self.is_finished_flag = False

    def katakana_to_hiragana(self, text: str) -> str:
        """カタカナをひらがなに変換する"""
        if not text: return ""
        return "".join([chr(ord(c) - 96) if "ァ" <= c <= "ヶ" else c for c in text])

    def record_used_word(self, word: str, player_id: str):
        """使用した単語を記録し、次の文字を決定する"""
        norm_word = self.katakana_to_hiragana(word)
        self.used[norm_word].append(player_id)
        self.word = norm_word
        self.character = self.sb_info.get_next_initial(norm_word)

    def get_player_label(self, player) -> str:
        """プレイヤーの識別子(ID)を返す"""
        return player.id

    def _calc_damage(self, at1, at2, dt1, dt2, attacker_ability, attacker, defender):
        """ダメージ計算ロジック"""
        effect = self.sb_info.type_effect(at1, at2, dt1, dt2)
        
        is_critical = False
        if attacker_ability and hasattr(attacker_ability, "should_force_critical"):
            if attacker_ability.should_force_critical([at1, at2]):
                is_critical = True
        
        if not is_critical and ("暴言" in [at1, at2] or "人体" in [at1, at2]):
            if random.random() < CRITICAL_HIT_CHANCE:
                is_critical = True

        if effect == 0:
            return 0, 0, False

        atk_mult = self.sb_info.rank_to_power(attacker.attack_rank)
        def_mult = self.sb_info.rank_to_power(defender.defense_rank)
        rank_correction = atk_mult / def_mult
        
        if is_critical:
            rank_correction = max(1.0, rank_correction)

        damage = 0.0
        if at1 == "" and at2 == "":
            damage = BASE_DAMAGE_NORMAL * rank_correction
        elif dt1 == "" and dt2 == "":
            damage = BASE_DAMAGE_TYPED * effect * rank_correction
        else:
            damage = BASE_DAMAGE_TYPED * effect * rank_correction
            damage *= random.uniform(DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX)

        return effect, int(damage), is_critical

    def _process_end_of_turn_effects(self, attacker, defender):
        """ターン終了時の継続効果（毒、やどりぎなど）を処理する"""
        if self.is_finished: return

        # 毒ダメージ
        for p in self.players:
            if not p.is_defeated and p.poison_turns > 0 and getattr(p, 'poisoner_id', None) == attacker.id:
                damage = int(MAX_HP * (p.poison_turns / 16))
                p.take_damage(damage)
                self.events.append({
                    "type": "damage",
                    "message": f"毒のダメージを受けた！",
                    "target": self.get_player_label(p),
                    "damage": damage,
                    "hp": p.hp
                })
                p.poison_turns += 1
                if p.is_defeated:
                    self.events.append({"type": "message", "message": f"{p.name}はたおれた！", "target": self.get_player_label(p)})

        # やどりぎ処理
        if attacker.leech_turns > 0:
            actual_defender = defender
            if hasattr(attacker, 'leech_target_id') and attacker.leech_target_id:
                for p in self.players:
                    if p.id == attacker.leech_target_id:
                        actual_defender = p
                        break

            if not actual_defender.is_defeated:
                drain_amount = LEECH_SEED_DRAIN_AMOUNT
                actual_drain = min(actual_defender.hp, drain_amount)
                
                actual_defender.take_damage(actual_drain)
                attacker.heal(actual_drain)
                attacker.leech_turns -= 1

                self.events.append({
                    "type": "drain",
                    "message": "やどりぎで体力を奪った！",
                    "target": self.get_player_label(actual_defender),
                    "damage": actual_drain,
                    "attacker": self.get_player_label(attacker),
                    "amount": actual_drain,
                    "hp": actual_defender.hp
                })
            else:
                attacker.leech_turns = 0

    def handle_disconnection(self, player_id: str, message: str = "あいてが通信を切断しました。"):
        """プレイヤーの切断を処理する"""
        if self.is_finished: return None
        
        disconnected_team_idx = -1
        for p in self.players:
            if p.owner_id == player_id:
                p.hp = 0
                self.events.append({"type": "message", "message": f"{p.name} は逃げ出した！", "target": self.get_player_label(p)})
                if disconnected_team_idx == -1:
                    disconnected_team_idx = self._get_team_index(p)
        
        if disconnected_team_idx != -1:
            self.winner_team = 1 - disconnected_team_idx
            
        self.events.append({"type": "error", "message": message})
        ret = self._make_response()
        self.events = []
        return ret

    def timeout(self):
        """タイムアウト処理"""
        if self.is_finished: return self._make_response()
        current_actor = self.get_current_actor()
        if not current_actor: return self._make_response()

        current_actor.hp = 0
        self.events.append({"type": "damage", "message": f"時間切れ！{current_actor.name}は力尽きた…", "target": self.get_player_label(current_actor), "damage": 0, "hp": 0})
        
        team_idx = self._get_team_index(current_actor)
        if team_idx != -1:
            self.winner_team = 1 - team_idx
            
        ret = self._make_response()
        self.events = []
        return ret

    def _get_team_index(self, player: Player) -> int:
        if hasattr(self, "player1") and player.id == self.player1.id: return 0
        if hasattr(self, "player2") and player.id == self.player2.id: return 1
        if hasattr(self, "team1") and player in self.team1: return 0
        if hasattr(self, "team2") and player in self.team2: return 1
        return -1

    def include_check(self, word: str, current_actor=None):
        """入力中の単語チェック"""
        word = self.katakana_to_hiragana(word)
        ret = {
            "type": "pre_check",
            "name": word,
            "include": False,
            "used": False,
            "type1": "",
            "type2": "",
        }
        if not word: return ret

        is_included = self.sb_info.include_in_all_words(word)
        ret["include"] = is_included

        if is_included:
            types = [t for t in self.sb_info.get_types(word) if t]
            ret["type1"] = types[0] if len(types) >= 1 else ""
            ret["type2"] = types[1] if len(types) >= 2 else ""
            
            if current_actor is None:
                if hasattr(self, "get_current_actor"):
                    current_actor = self.get_current_actor()
                elif hasattr(self, "player1_turn"):
                    current_actor = self.player1 if getattr(self, "player1_turn", True) else self.player2

            if current_actor:
                at1, at2 = ret["type1"], ret["type2"]
                if hasattr(self, "team1") and hasattr(self, "team2"):
                    enemies = self.team2 if current_actor in self.team1 else self.team1
                    predictions = {}
                    for enemy in enemies:
                        if not enemy.is_defeated:
                            dt1 = enemy.types[0] if len(enemy.types) >= 1 else ""
                            dt2 = enemy.types[1] if len(enemy.types) >= 2 else ""
                            effect = self.sb_info.type_effect(at1, at2, dt1, dt2)
                            predictions[enemy.id] = self._get_effect_message(effect)
                    ret["predictions"] = predictions
                else:
                    if hasattr(self, "player1") and hasattr(self, "player2"):
                        defender = self.player2 if current_actor.id == self.player1.id else self.player1
                        dt1 = defender.types[0] if len(defender.types) >= 1 else ""
                        dt2 = defender.types[1] if len(defender.types) >= 2 else ""
                        effect = self.sb_info.type_effect(at1, at2, dt1, dt2)
                        ret["prediction"] = self._get_effect_message(effect)

        if word in self.used:
            ret["used"] = True
        return ret

    def _get_effect_message(self, effect: float) -> str:
        if effect > 1: return "効果はばつぐんだ！"
        if effect == 1: return "ふつうのダメージだ"
        if effect > 0: return "効果はいまひとつのようだ…"
        return "効果はないようだ…"

    @property
    def is_finished(self) -> bool:
        raise NotImplementedError

    def get_current_actor(self) -> Player:
        raise NotImplementedError

    def _handle_knockout(self, player: Player):
        """プレイヤーが倒れた時のデフォルト処理"""
        self.events.append({"type": "message", "message": f"{player.name}はたおれた！", "target": self.get_player_label(player)})

    def _make_response(self) -> dict:
        raise NotImplementedError

    def get_personalized_response(self, base_response: dict, player_id: str) -> dict:
        raise NotImplementedError

    def execute_attack_flow(self, current_player, target_player, word: str, types: list[str], ability_obj) -> bool:
        self.current_actor = current_player
        self.current_target = target_player

        if ability_obj and ability_obj.check_condition(current_player, types, word):
            if ability_obj.replaces_damage:
                ability_obj.apply_damage_replacement_effect(current_player, self)
                return True

        at1 = types[0] if len(types) >= 1 else ""
        at2 = types[1] if len(types) >= 2 else ""
        dt1 = target_player.types[0] if len(target_player.types) >= 1 else ""
        dt2 = target_player.types[1] if len(target_player.types) >= 2 else ""

        if "食べ物" in types:
            limit = FOOD_LIMIT
            ignore_limit = ability_obj and ability_obj.should_ignore_food_limit()
            if ignore_limit or current_player.food_count < limit:
                current_player.food_count += 1
                cure_amount = FOOD_RECOVERY_AMOUNT
                if ability_obj: cure_amount = ability_obj.get_food_recovery_amount(cure_amount)
                
                self.events.append({
                    "type": "cure", 
                    "message": "体力が回復した", 
                    "amount": cure_amount,
                    "target": current_player.id,
                    "hp": current_player.hp
                })
                current_player.heal(cure_amount)
            else:
                self.events.append({"type": "message", "message": "もう食べられない！", "target": current_player.id})
        elif "医療" in types:
            if current_player.medical_count < MEDICAL_LIMIT:
                current_player.medical_count += 1
                if current_player.poison_turns > 0:
                    current_player.poison_turns = 0
                    current_player.poisoner_id = None
                    self.events.append({"type": "cure_poison", "message": "毒が治った！", "target": current_player.id})
                
                self.events.append({
                    "type": "cure", 
                    "message": "体力が回復した", 
                    "amount": MEDICAL_RECOVERY_AMOUNT,
                    "target": current_player.id,
                    "hp": current_player.hp
                })
                current_player.heal(MEDICAL_RECOVERY_AMOUNT)
            else:
                self.events.append({"type": "message", "message": "もう回復できない！", "target": current_player.id})
        else:
            effect, damage, is_critical = self._calc_damage(at1, at2, dt1, dt2, ability_obj, current_player, target_player)
            if ability_obj: damage = int(damage * ability_obj.get_damage_multiplier(types, word))
            if is_critical: damage = int(damage * CRITICAL_HIT_MULTIPLIER)
            
            msg = self._get_effect_message(effect)
            
            self.events.append({
                "type": "damage", 
                "message": msg, 
                "damage": damage,
                "attacker": current_player.id,
                "target": target_player.id,
                "hp": max(0, target_player.hp - damage)
            })
            
            if is_critical: 
                self.events.append({"type": "critical", "message": "急所に当たった！", "attacker": current_player.id, "target": target_player.id})
            
            defender_ability = getattr(self, "abilities", {}).get(target_player.ability)
            if defender_ability:
                try: defender_ability.on_receive_damage(target_player, current_player, damage, effect, self)
                except Exception: pass

            target_player.take_damage(damage)
            if target_player.is_defeated: 
                if hasattr(self, "_handle_knockout"):
                    self._handle_knockout(target_player)
                else:
                    self.events.append({"type": "message", "message": f"{target_player.name}はたおれた！", "target": target_player.id})

        if "暴力" in types:
            drop = VIOLENCE_ATTACK_DROP
            if ability_obj: drop -= ability_obj.get_violence_penalty_reduction()
            current_player.attack_rank = max(MIN_RANK, current_player.attack_rank - drop)
            self.events.append({
                "type": "stat_down", 
                "message": "攻撃が下がった！", 
                "stat_type": "attack", 
                "new_rank": current_player.attack_rank,
                "target": current_player.id
            })

        if ability_obj and not ability_obj.replaces_damage and ability_obj.check_condition(current_player, types, word):
            try: ability_obj.apply_after_effect(current_player, self)
            except Exception: pass
            
        return True

    def _get_serializable_abilities(self):
        """フロントエンド渡す特性データを作成"""
        serializable_abilities = {}
        for ability_id, ability_obj in self.abilities.items():
            serializable_abilities[ability_id] = ability_obj.get_display_data()
        serializable_abilities["secret"] = {
            "name": "ひみつ",
            "description": "相手もきみのとくせいを知らないぞ",
            "icon_type": "ノーマル"
        }
        return serializable_abilities
