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
        self.turn_order = []
        self.current_turn_index = 0
        self.START_CHARACTERS = "あいうえおかきくけこさしすせそたちつてとなにねのはひふへほまみむめやゆよらりるれろわ"
        self.winner_team = None 
        self.last_actor_id = None
        self.is_finished_flag = False
        self.is_cpu_battle = False

    @property
    def is_cpu(self) -> bool:
        return self.is_cpu_battle

    def execute_cpu_turn(self) -> dict:
        """
        CPUの標準的な行動ループ。
        単語を探し、あれば攻撃、なければ失敗処理を行う。
        """
        actor = self.get_current_actor()
        if not actor:
            return self._make_response()
        
        cpu_word = self.get_cpu_word()
        if cpu_word:
            # ターゲットを選択して攻撃
            target_id = self._select_cpu_target(actor)
            return self.try_attack(actor.owner_id, cpu_word, target_id=target_id)
        else:
            # 単語が見つからなかった場合
            return self._handle_cpu_failure(actor)

    def get_cpu_word(self) -> str:
        """標準的なCPUの単語検索ロジック"""
        candidates = self.sb_info.get_typed_word_candidates(self.character)
        for word in candidates:
            if not self._is_used(word):
                return word
        return ""

    def _select_cpu_target(self, actor: Player) -> str | None:
        """CPUの攻撃対象を選択する (サブクラスで実装)"""
        raise NotImplementedError

    def _handle_cpu_failure(self, actor: Player) -> dict:
        """CPUが単語を思いつかなかった時の共通処理"""
        actor.hp = 0
        self.events.append({
            "type": "knockout",
            "message": f"{actor.name}は ことばを思いつかなかった！",
            "target": self.get_player_label(actor),
            "hp": 0
        })
        self._check_win_condition()
        self.advance_turn()
        
        ret = self._make_response()
        self.word, self.events = "", []
        return ret

    @property
    def is_double(self) -> bool:
        raise NotImplementedError

    @property
    def time_limit(self) -> int:
        raise NotImplementedError

    def _validate_word(self, player_id: str, word: str) -> dict | None:
        """しりとりとしての正当性チェック (共通)"""
        current_actor = self.get_current_actor()
        if player_id != current_actor.owner_id:
            return {"type": "error", "message": "あなたのターンではありません"}

        word = self.katakana_to_hiragana(word)
        if not word or word[0] != self.character:
            return {"type": "error", "message": "開始文字がマッチしていません"}
        
        if word in self.used:
            return {"type": "error", "message": "その単語は既に使用されています"}
        
        if not self.sb_info.include_in_all_words(word):
            return {"type": "error", "message": "辞書にない単語です"}

        if self.sb_info.get_next_initial(word) == "ん":
            return {"type": "error", "message": "「ん」で終わっています"}
            
        return None

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

    def get_player_label(self, player: Player) -> str:
        """
        メッセージやイベントのターゲット指定に使用するラベル。
        フロントエンドの演出(アニメーション等)のために、原則としてIDを返す。
        """
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
                    self._handle_knockout(p)

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
                    "hp": actual_defender.hp,
                    "attacker_hp": attacker.hp
                })
                if actual_defender.is_defeated:
                    self._handle_knockout(actual_defender)
            else:
                attacker.leech_turns = 0

    def finish_battle(self, winner_team: int):
        """バトルの決着処理を共通化"""
        self.winner_team = winner_team
        
        # 二重追加防止 (イベントリスト内に既に battle_result がないか確認)
        if any(e.get("type") == "battle_result" for e in self.events if isinstance(e, dict)):
            return

        msg = "あいてとの勝負に勝った！" if winner_team == 0 else "あいてとの勝負に負けた…"
        self.events.append({
            "type": "battle_result",
            "message": msg,
            "winner_team": winner_team
        })

    def handle_disconnection(self, player_id: str, message: str = "あいてが通信を切断しました。"):
        """プレイヤーの切断を処理する"""
        if self.is_finished: return None
        
        self.word = "" # フロントエンドの溜め時間を防ぐためにクリア
        disconnected_team_idx = -1
        try:
            for p in self.players:
                if p.owner_id == player_id:
                    p.hp = 0
                    self.events.append({"type": "message", "message": f"{p.name} は逃げ出した！", "target": self.get_player_label(p)})
                    if disconnected_team_idx == -1:
                        disconnected_team_idx = self._get_team_index(p)
            
            if disconnected_team_idx != -1:
                self.finish_battle(1 - disconnected_team_idx)
            else:
                # 誰が切断したか不明な場合でも終了させる
                self.finish_battle(0) 
        except Exception:
            self.winner_team = 0 # 最悪でも終了フラグを立てる
            
        ret = self._make_response()
        self.events = []
        return ret

    def change_ability(self, player_id: str, new_ability_id: str, char_id: str = None):
        """特性変更の共通ロジック"""
        target_char = self.find_character(player_id, char_id)
        
        if not target_char or target_char.owner_id != player_id:
            return {"type": "error", "message": "不正な操作です"}
        
        # 同じ特性を選んだ場合は、回数を減らさずそのまま終了 (本家挙動)
        if new_ability_id == target_char.ability:
            return self._make_response()

        if target_char.ability_change_count <= 0:
            return {"type": "error", "message": "特性はもう変更できません"}
        
        # 特性リストの存在確認
        if not hasattr(self, 'abilities') or new_ability_id not in self.abilities:
            return {"type": "error", "message": "存在しない特性です"}
            
        # 実行
        target_char.ability_change_count -= 1
        target_char.ability = new_ability_id
        
        # イベント追加 (メッセージなし)
        self.events.append({
            "type": "ability_changed",
            "target": target_char.id,
            "new_ability": new_ability_id,
            "new_ability_change_count": target_char.ability_change_count
        })
        
        return self._make_response()

    def find_character(self, player_id: str, char_id: str = None):
        """player_id または char_id から操作対象のキャラクターを特定する"""
        if char_id:
            return self.get_player_by_id(char_id)
        
        # char_id がない場合は、player_id が所有する最初のキャラクターを返す (SingleBattle用)
        for p in self.players:
            if p.owner_id == player_id:
                return p
        return None

    def timeout(self):
        """タイムアウト処理"""
        if self.is_finished: return self._make_response()
        current_actor = self.get_current_actor()
        if not current_actor: return self._make_response()

        current_actor.hp = 0
        self.events.append({
            "type": "knockout", 
            "message": f"時間切れ！{current_actor.name}は力尽きた…", 
            "target": self.get_player_label(current_actor), 
            "damage": 0, 
            "hp": 0
        })
        
        team_idx = self.get_team_index(current_actor)
        if team_idx != -1:
            self.finish_battle(1 - team_idx)
            
        ret = self._make_response()
        self.events = []
        return ret

    def get_player_by_id(self, char_id: str):
        """IDからキャラクターを特定する"""
        for p in self.players:
            if p.id == char_id:
                return p
        return None

    def _get_team_index(self, player) -> int:
        """後方互換用 (内部では get_team_index を呼ぶ)"""
        return self.get_team_index(player)

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
            at1 = types[0] if len(types) >= 1 else ""
            at2 = types[1] if len(types) >= 2 else ""
            ret["type1"], ret["type2"] = at1, at2
            
            if current_actor is None:
                current_actor = self.get_current_actor()

            if current_actor:
                enemies = self.get_enemies(current_actor)
                # サブクラスにレスポンス形式の整形を任せる
                ret.update(self.format_predictions(enemies, at1, at2))

        if word in self.used:
            ret["used"] = True
        return ret

        if word in self.used:
            ret["used"] = True
        return ret

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
        return self.winner_team is not None

    def get_current_actor(self) -> Player:
        """
        現在の行動者(Player)を返す。
        倒れているプレイヤーは自動的にスキップして次の生存者を探す。
        """
        if not self.turn_order:
            return None
            
        initial_index = self.current_turn_index
        while True:
            actor = self.turn_order[self.current_turn_index]
            if not actor.is_defeated:
                return actor
            
            # スキップして次へ
            self.current_turn_index = (self.current_turn_index + 1) % len(self.turn_order)
            if self.current_turn_index == 0:
                self.turn += 1
            
            # 全員倒れているなどの無限ループ防止
            if self.current_turn_index == initial_index:
                return actor # 仕方ないのでそのまま返す
    
    def advance_turn(self):
        """
        ターンインデックスを次に進める。
        インデックスが0に戻るタイミングで、バトル全体の turn 数をインクリメントする。
        """
        if not self.turn_order:
            return
            
        self.current_turn_index = (self.current_turn_index + 1) % len(self.turn_order)
        if self.current_turn_index == 0:
            self.turn += 1

    def get_enemies(self, player: Player) -> list[Player]:
        """そのプレイヤーから見た敵全員を返す"""
        raise NotImplementedError

    def get_team_index(self, player: Player) -> int:
        """そのプレイヤーが属するチームのインデックスを返す"""
        raise NotImplementedError

    def format_predictions(self, enemies: list[Player], at1: str, at2: str) -> dict:
        """相性予測の結果を各モードに適した形式(prediction/predictions)で返す"""
        raise NotImplementedError

    def _handle_knockout(self, player: Player):
        """プレイヤーが倒れた時のデフォルト処理"""
        self.events.append({
            "type": "knockout", 
            "message": f"{player.name}はたおれた！", 
            "target": self.get_player_label(player)
        })

    def _make_response(self) -> dict:
        raise NotImplementedError

    def is_player_winner(self, player_id: str) -> bool:
        """指定したプレイヤーが勝利チームに属しているか判定する (サブクラスで実装)"""
        raise NotImplementedError

    def _personalize_events(self, events: list, is_winner: bool):
        """イベントリスト内のメッセージを閲覧プレイヤーの視点に合わせて調整する"""
        for event in events:
            if not isinstance(event, dict):
                continue
            if event.get("type") == "battle_result":
                event["message"] = "あいてとの勝負に勝った！" if is_winner else "あいてとの勝負に負けた…"

    def get_personalized_response(self, base_response: dict, player_id: str) -> dict:
        """レスポンスを特定のプレイヤー視点に調整する (サブクラスで実装)"""
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
                
                current_player.heal(cure_amount)
                self.events.append({
                    "type": "cure", 
                    "message": "体力が回復した", 
                    "amount": cure_amount,
                    "target": current_player.id,
                    "hp": current_player.hp
                })
            else:
                self.events.append({"type": "message", "message": "もう食べられない！", "target": current_player.id})
        elif "医療" in types:
            if current_player.medical_count < MEDICAL_LIMIT:
                current_player.medical_count += 1
                if current_player.poison_turns > 0:
                    current_player.poison_turns = 0
                    current_player.poisoner_id = None
                    self.events.append({"type": "cure_poison", "message": "毒が治った！", "target": current_player.id})
                
                current_player.heal(MEDICAL_RECOVERY_AMOUNT)
                self.events.append({
                    "type": "cure", 
                    "message": "体力が回復した", 
                    "amount": MEDICAL_RECOVERY_AMOUNT,
                    "target": current_player.id,
                    "hp": current_player.hp
                })
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
                self._handle_knockout(target_player)

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

    def _create_base_response(self, players: list[Player], **kwargs) -> dict:
        """
        共通のレスポンス生成ロジック。
        Player オブジェクトのリストから、スキーマに沿った辞書形式のレスポンスを作成する。
        """
        chars = {}
        for p in players:
            chars[p.id] = CharacterState(
                name=p.name,
                hp=p.hp,
                max_hp=MAX_HP,
                attack_rank=p.attack_rank,
                defense_rank=p.defense_rank,
                attack_power=self.sb_info.rank_to_power(p.attack_rank),
                defense_power=self.sb_info.rank_to_power(p.defense_rank),
                types=p.types,
                is_poison=p.poison_turns > 0,
                ability=p.ability,
                ability_change_count=p.ability_change_count,
                lives=getattr(p, 'lives', None),
                owner_id=p.owner_id
            )
        
        current_actor = self.get_current_actor()
        
        # 共通のベース状態
        state_data = {
            "room_id": self.room_id,
            "character": self.character,
            "is_my_turn": False, # personalization層で設定
            "turn": self.turn,
            "last_actor_id": self.last_actor_id,
            "word": self.word,
            "characters": chars,
            "winner_team": self.winner_team,
            "status": "finished" if self.is_finished else "active",
            "ally_win": None, # personalization層で設定
            "is_cpu": self.is_cpu_battle,
            "current_actor_id": current_actor.id if current_actor else None,
            "current_owner_id": current_actor.owner_id if current_actor else None
        }
        # 追加のフィールドがあれば上書き・追加
        state_data.update(kwargs)
        
        state = BattleState(**state_data)
        
        # イベントのバリデーションと変換
        validated_events = []
        for e in self.events:
            if isinstance(e, dict):
                validated_events.append(BattleEvent(**e))
            else:
                validated_events.append(e)
        
        res = BattleResponse(state=state, events=validated_events).model_dump(by_alias=True)
        res["type"] = "battle_end" if self.is_finished else "update"
        return res
