try:
    from SB_info import SB_info
    from constants import *
    from player import Player
except ImportError:
    from backend.SB_info import SB_info
    from backend.constants import *
    from backend.player import Player

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
        self.turn = 0
        self.word = ""
        self.character = ""
        self.players = [] # サブクラスでPlayerオブジェクトを格納する
        self.START_CHARACTERS = "あいうえおかきくけこさしすせそたちつてとなにねのはひふへほまみむめやゆよらりるれろわ"
        self.winner_team = None # None: 進行中, 0: チーム1勝利, 1: チーム2勝利

    def katakana_to_hiragana(self, text: str) -> str:
        """カタカナをひらがなに変換する"""
        return "".join([chr(ord(c) - 96) if "ァ" <= c <= "ヶ" else c for c in text])

    def record_used_word(self, word: str, player_id: str):
        """使用した単語を記録し、次の文字を決定する"""
        self.used[word] = player_id
        self.word = word
        self.character = self.sb_info.get_next_initial(word)

    def get_player_label(self, player) -> str:
        """プレイヤーの識別子を返す（Singleならally/foe、DoubleならID）"""
        return player.id

    def _calc_damage(self, at1, at2, dt1, dt2, attacker_ability, attacker, defender):
        """
        ダメージを計算します
        """
        effect = self.sb_info.type_effect(at1, at2, dt1, dt2)
        
        # 急所判定
        is_critical = False
        if attacker_ability and hasattr(attacker_ability, "should_force_critical"):
            if attacker_ability.should_force_critical([at1, at2]):
                is_critical = True
        
        if not is_critical and ("暴言" in [at1, at2] or "人体" in [at1, at2]):
            if random.random() < CRITICAL_HIT_CHANCE:
                is_critical = True

        if effect == 0:
            return 0, 0, False

        # ランク補正
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
        # 勝敗判定はサブクラスに任せるか、プロパティを参照する
        if self.is_finished: return

        # 毒ダメージ処理
        for p in self.players:
            # 毒ダメージの発生条件: 毒を仕掛けた本人が行動したターンの終了時のみ
            if not p.is_defeated and p.poison_turns > 0 and getattr(p, 'poisoner_id', None) == attacker.id:
                damage = int(MAX_HP * (p.poison_turns / 16))
                p.take_damage(damage)
                self.events.append({
                    "type": "damage",
                    "message": f"毒のダメージを受けた！",
                    "target": self.get_player_label(p),
                    "damage": damage
                })
                p.poison_turns += 1
                if p.is_defeated:
                    self.events.append({"type": "message", "message": f"{p.name}はたおれた！"})
                    if hasattr(p, "is_active"): p.is_active = False

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
                    "cure_amount": actual_drain
                })
            else:
                attacker.leech_turns = 0

    def handle_disconnection(self, player_id: str, message: str = "あいてが通信を切断しました。"):
        """プレイヤーの切断を処理する"""
        if self.is_finished: return None
        for p in self.players:
            if p.owner_id == player_id and not p.is_defeated:
                p.hp = 0
                self.events.append({"type": "message", "message": f"{p.name} は逃げ出した！"})
        self.events.append({"type": "error", "message": message})
        self._check_win_condition()
        ret = self._make_response()
        self.events = []
        return ret

    def timeout(self):
        """現在の行動プレイヤーのタイムアウト処理（即敗北）"""
        if self.is_finished: return self._make_response()
        current_actor = self.get_current_actor()
        if not current_actor: return self._make_response()

        current_actor.hp = 0
        self.events.append({"type": "damage", "message": f"時間切れ！{current_actor.name}は力尽きた…", "target": self.get_player_label(current_actor), "damage": 0})
        
        # 即座に相手チームの勝利にする
        team_idx = self._get_team_index(current_actor)
        if team_idx != -1:
            self.winner_team = 1 - team_idx
            
        ret = self._make_response()
        self.events = []
        return ret

    def _get_serializable_abilities(self):
        """特性一覧のシリアライズ（全バトル共通）"""
        return {k: v.get_display_data() for k, v in self.abilities.items()}

    def get_current_actor(self) -> Player:
        """現在の行動順のプレイヤーを返す（サブクラスで実装）"""
        raise NotImplementedError

    def _check_win_condition(self) -> bool:
        """勝敗判定を行い、winner_teamを更新する（サブクラスで実装）"""
        raise NotImplementedError

    def _handle_knockout(self, player: Player):
        """プレイヤーが倒れた時の処理（サブクラスで実装）"""
        raise NotImplementedError

    def handle_disconnection(self, player_id: str, message: str = "あいてが通信を切断しました。"):
        if self.is_finished: return None
        
        disconnected_team_idx = -1
        for p in self.players:
            if p.owner_id == player_id:
                p.hp = 0
                self.events.append({"type": "message", "message": f"{p.name} は逃げ出した！"})
                if disconnected_team_idx == -1:
                    disconnected_team_idx = self._get_team_index(p)
        
        if disconnected_team_idx != -1:
            self.winner_team = 1 - disconnected_team_idx
            
        self.events.append({"type": "error", "message": message})
        ret = self._make_response()
        self.events = []
        return ret

    def _get_team_index(self, player: Player) -> int:
        """プレイヤーが属するチームインデックス(0 or 1)を返す。見つからない場合は-1"""
        if hasattr(self, "player1") and player.id == self.player1.id: return 0
        if hasattr(self, "player2") and player.id == self.player2.id: return 1
        if hasattr(self, "team1") and player in self.team1: return 0
        if hasattr(self, "team2") and player in self.team2: return 1
        return -1

    def _get_serializable_abilities(self):
        """現在のターンがCPUかどうか"""
        raise NotImplementedError

    def _make_response(self) -> dict:
        """レスポンスを生成する（サブクラスで実装）"""
        raise NotImplementedError

    def include_check(self, word: str, current_actor=None):
        """入力中の単語のタイプチェックと相性予測"""
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
            
            # 自動で行動者を特定
            if current_actor is None:
                if hasattr(self, "get_current_actor"): # Double Battle
                    current_actor = self.get_current_actor()
                elif hasattr(self, "player1_turn"): # Single Battle
                    current_actor = self.player1 if getattr(self, "player1_turn", True) else self.player2

            # 相性予測
            if current_actor:
                at1, at2 = ret["type1"], ret["type2"]
                # 敵対プレイヤーの特定
                if hasattr(self, "team1") and hasattr(self, "team2"): # Double Battle
                    enemies = self.team2 if current_actor in self.team1 else self.team1
                    predictions = {}
                    for enemy in enemies:
                        if not enemy.is_defeated:
                            dt1 = enemy.types[0] if len(enemy.types) >= 1 else ""
                            dt2 = enemy.types[1] if len(enemy.types) >= 2 else ""
                            effect = self.sb_info.type_effect(at1, at2, dt1, dt2)
                            predictions[enemy.id] = self._get_effect_message(effect)
                    ret["predictions"] = predictions
                else: # Single Battle
                    # attacker/defender の特定 (Single Battle 固有の属性を想定)
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
        """ゲームが終了しているかどうかを返す（サブクラスで実装）"""
        raise NotImplementedError

    def init_character(self):
        """開始文字をランダムに決定"""
        self.character = random.choice(self.START_CHARACTERS)

    def katakana_to_hiragana(self, text: str) -> str:
        """全角カタカナをひらがなに変換する"""
        if not text: return ""
        return "".join(chr(ord(c) - 96) if 0x30A1 <= ord(c) <= 0x30F6 else c for c in text)

    def validate_word(self, word: str) -> tuple[str | None, dict | None]:
        """
        単語がしりとりルールおよび辞書に適合するかチェックする
        Returns:
            tuple[正規化済み単語, エラーレスポンス]
        """
        if self.is_finished:
            return None, {"type": "error", "message": "戦闘はすでに終了しています"}

        norm_word = self.katakana_to_hiragana(word)

        if not norm_word:
            return None, {"type": "error", "message": "単語を入力してください"}
        
        # 辞書チェック
        if not self.sb_info.include_in_all_words(norm_word) and not self.sb_info.include_in_typed_words(norm_word):
            return None, {"type": "error", "message": "辞書にない単語です"}
        
        # 使用済みチェック
        if norm_word in self.used:
            return None, {"type": "error", "message": "使用済みの単語です"}
        
        # 開始文字チェック
        if not norm_word.startswith(self.character):
            return None, {"type": "error", "message": f"「{self.character}」からはじまることばを入力してください"}
        
        # 「ん」終了チェック
        next_initial = self.sb_info.get_next_initial(norm_word)
        if next_initial == "ん":
            return None, {"type": "error", "message": "「ん」で終わっています"}
        
        # 次の文字が辞書に存在するかチェック
        if not self.sb_info.include_in_typed_heads(next_initial):
            return None, {"type": "error", "message": "禁止された単語です"}
        
        return norm_word, None

    def _type_check(self, word: str) -> list[str]:
        """単語のタイプを取得"""
        t1, t2 = self.sb_info.get_types(word)
        types = []
        if t1: types.append(t1)
        if t2: types.append(t2)
        return types

    def record_used_word(self, word: str, actor_id: str):
        """単語を使用済みリストに登録し、次の文字を更新"""
        norm_word = self.katakana_to_hiragana(word)
        self.used[norm_word].append(actor_id)
        self.character = self.sb_info.get_next_initial(norm_word)

    def execute_attack_flow(self, current_player, target_player, word: str, types: list[str], ability_obj, is_single: bool = True) -> bool:
        """
        攻撃処理の共通フローを実行する
        Returns:
            bool: 攻撃が完了したかどうか（Falseの場合は中断など）
        """
        # 特性などから参照できるように現在の状態を保存
        self.current_actor = current_player
        self.current_target = target_player

        # 特性発動 (ダメージ置換系)
        if ability_obj and ability_obj.check_condition(current_player, types, word):
            if ability_obj.replaces_damage:
                ability_obj.apply_damage_replacement_effect(current_player, self)
                return True

        # 通常攻撃
        at1 = types[0] if len(types) >= 1 else ""
        at2 = types[1] if len(types) >= 2 else ""
        dt1 = target_player.types[0] if len(target_player.types) >= 1 else ""
        dt2 = target_player.types[1] if len(target_player.types) >= 2 else ""

        # 回復系処理
        if "食べ物" in types:
            limit = FOOD_LIMIT
            ignore_limit = ability_obj and ability_obj.should_ignore_food_limit()
            if ignore_limit or current_player.food_count < limit:
                current_player.food_count += 1
                cure_amount = FOOD_RECOVERY_AMOUNT
                if ability_obj: cure_amount = ability_obj.get_food_recovery_amount(cure_amount)
                
                # イベント送信形式を統一
                self.events.append({
                    "type": "cure", 
                    "message": "体力が回復した", 
                    "amount": cure_amount,
                    "target": current_player.id
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
                    # JSON構造の統一に向けてplayer/target両方を付与
                    self.events.append({"type": "cure_poison", "message": "毒が治った！", "target": current_player.id})
                
                self.events.append({
                    "type": "cure", 
                    "message": "体力が回復した", 
                    "amount": MEDICAL_RECOVERY_AMOUNT,
                    "target": current_player.id
                })
                current_player.heal(MEDICAL_RECOVERY_AMOUNT)
            else:
                self.events.append({"type": "message", "message": "もう回復できない！", "target": current_player.id})
        else:
            effect, damage, is_critical = self._calc_damage(at1, at2, dt1, dt2, ability_obj, current_player, target_player)
            if ability_obj: damage = int(damage * ability_obj.get_damage_multiplier(types, word))
            if is_critical: damage = int(damage * CRITICAL_HIT_MULTIPLIER)
            
            msg = self._get_effect_message(effect)
            
            # シングル・ダブルの互換性を取るためのイベント構築
            event = {
                "type": "damage", 
                "message": msg, 
                "damage": damage,
                "attacker": current_player.id,
                "target": target_player.id
            }
            self.events.append(event)
            
            if is_critical: 
                self.events.append({"type": "critical", "message": "急所に当たった！", "attacker": current_player.id, "target": target_player.id})
            
            # 防御側特性
            defender_ability = getattr(self, "abilities", {}).get(target_player.ability)
            if defender_ability:
                try: defender_ability.on_receive_damage(target_player, current_player, damage, effect, self)
                except Exception: pass

            target_player.take_damage(damage)
            if target_player.is_defeated: 
                # 撃破処理は各クラスに委譲
                if hasattr(self, "_handle_knockout"):
                    self._handle_knockout(target_player)
                else:
                    self.events.append({"type": "message", "message": f"{target_player.name}はたおれた！", "target": target_player.id})

        # 暴力ペナルティ
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

        # 事後特性
        if ability_obj and not ability_obj.replaces_damage and ability_obj.check_condition(current_player, types, word):
            try: ability_obj.apply_after_effect(current_player, self)
            except Exception: pass
            
        return True

    def get_personalized_response(self, base_response: dict, player_id: str) -> dict:
        """プレイヤーの視点に合わせてレスポンスを加工する（サブクラスで実装）"""
        raise NotImplementedError

    def _get_serializable_abilities(self):
        """
        フロントエンドに渡すための、JSONシリアライズ可能な特性データの辞書を作成する。
        """
        serializable_abilities = {}
        for ability_id, ability_obj in self.abilities.items():
            serializable_abilities[ability_id] = ability_obj.get_display_data()
        serializable_abilities["secret"] = {
            "name": "ひみつ",
            "description": "相手もきみのとくせいを知らないぞ",
            "icon_type": "ノーマル"
        }
        return serializable_abilities
