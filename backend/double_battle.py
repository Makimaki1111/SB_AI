try:
    from SB_info import SB_info
except ImportError:
    from backend.SB_info import SB_info

try:
    from battle import Player, get_default_abilities, MAX_HP, FOOD_LIMIT, MEDICAL_LIMIT, MIN_RANK, MAX_RANK, FOOD_RECOVERY_AMOUNT, MEDICAL_RECOVERY_AMOUNT, CRITICAL_HIT_CHANCE, CRITICAL_HIT_MULTIPLIER, BASE_DAMAGE_NORMAL, BASE_DAMAGE_TYPED, DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX, VIOLENCE_ATTACK_DROP
except ImportError:
    from backend.battle import Player, get_default_abilities, MAX_HP, FOOD_LIMIT, MEDICAL_LIMIT, MIN_RANK, MAX_RANK, FOOD_RECOVERY_AMOUNT, MEDICAL_RECOVERY_AMOUNT, CRITICAL_HIT_CHANCE, CRITICAL_HIT_MULTIPLIER, BASE_DAMAGE_NORMAL, BASE_DAMAGE_TYPED, DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX, VIOLENCE_ATTACK_DROP

from collections import defaultdict
from pydantic import BaseModel
import random
import uuid

# --- Constant Configurations (Reusing from battle.py mostly) ---
# Assuming these are same as battle.py but we redefine or import.
# We imported them from battle.py to avoid duplication.
ABILITY_CHANGE_COUNT_INIT = 2

class DoubleBattlePlayer(Player):
    """ダブルバトル用に拡張したプレイヤークラス"""
    def __init__(self, player_id: str, character_id: str, name: str):
        # player_id: このキャラを操作するユーザーのID
        # character_id: 'p1a', 'p1b', 'p2a', 'p2b' といったキャラ固有のID
        super().__init__(character_id, name)
        self.owner_id = player_id # 操作権を持つユーザー
        self.is_active = True # 戦闘不能かどうか

    @property
    def is_defeated(self) -> bool:
        return self.hp <= 0

class DoubleBattle_info:
    """
    ダブルバトルの状態を管理するクラス。
    2体のキャラクター(A, B) vs 2体のキャラクター(A, B)の戦いを想定。
    """
    # mode = '1v1_double' (2 players, 4 chars) or '2v2_double' (4 players, 4 chars)
    def __init__(self, mode: str, team1_players: list, team2_players: list, sb_info: SB_info, room_id: str | None = None, profiles: dict = None):
        self.room_id = room_id or str(uuid.uuid4())
        self.mode = mode
        self.used = defaultdict(list)
        self.sb_info = sb_info
        
        # 特性関連
        self.abilities = get_default_abilities()
        self.ability_ids = list(self.abilities.keys())
        
        profiles = profiles or {}

        # チーム1 (Player1サイド: p1a, p1b)
        self.p1a = self._create_character(team1_players[0], 'p1a', "じぶんA", profiles)
        self.p1b = self._create_character(team1_players[1] if len(team1_players) > 1 else team1_players[0], 'p1b', "じぶんB", profiles)
        
        # チーム2 (Player2サイド: p2a, p2b)
        self.p2a = self._create_character(team2_players[0], 'p2a', "あいてA", profiles)
        self.p2b = self._create_character(team2_players[1] if len(team2_players) > 1 else team2_players[0], 'p2b', "あいてB", profiles)

        self.team1 = [self.p1a, self.p1b]
        self.team2 = [self.p2a, self.p2b]

        self.team1_win = None
        
        # 行動順(ターン管理)。p1a -> p2a -> p1b -> p2b の順を基本とする
        self.turn_order = [self.p1a, self.p2a, self.p1b, self.p2b]
        self.current_turn_index = 0

        self.START_CHARACTER = "あいうえおかきくけこさしすせそたちつてとなにねのはひふへほまみむめやゆよらりるれろわ"
        self.character = random.choice(self.START_CHARACTER)
        self.last_actor_id = None
        self.events = []
        self.turn = 0
        self.word = ""

    def _create_character(self, owner_id: str, char_id: str, default_name: str, profiles: dict) -> DoubleBattlePlayer:
        prof = profiles.get(owner_id, {})
        # ダブルバトル用にキャラA,Bで名前を少し区別するかもだが、今回は同じプロファイル名＋A/Bサフィックスなどでもいいかも
        name = prof.get("name", default_name)
        if len(name) > 6: name = name[:6] # UIの都合で気持ち短めにする
        name = f"{name}({char_id[-1].upper()})" # 'じぶん(A)' などにする

        char = DoubleBattlePlayer(owner_id, char_id, name)
        
        # 特性
        if prof.get("ability") in self.abilities:
            char.ability = prof["ability"]
        else:
            char.ability = random.choice(self.ability_ids)
            
        return char

    def get_current_actor(self) -> DoubleBattlePlayer:
        """現在行動権を持つキャラクターを取得。戦闘不能ならスキップするロジックを含む。"""
        # 戦闘不能のキャラはスキップ
        loops = 0
        while self.turn_order[self.current_turn_index].is_defeated and loops < 4:
            self._advance_turn_index()
            loops += 1
        return self.turn_order[self.current_turn_index]

    def _advance_turn_index(self):
        self.current_turn_index = (self.current_turn_index + 1) % 4
        if self.current_turn_index == 0:
            self.turn += 1

    def _check_win_condition(self):
        t1_dead = all(p.is_defeated for p in self.team1)
        t2_dead = all(p.is_defeated for p in self.team2)
        
        if t1_dead and t2_dead:
            # 引き分けの場合はあえてNoneにせず、便宜上何かしら処理するならここで分岐
            self.team1_win = False # ひとまず相打ちは負け扱い、または引き分けフラグにするか要検討
        elif t1_dead:
            self.team1_win = False
        elif t2_dead:
            self.team1_win = True
            
        # 勝敗が決定したら、現在の行動者をなしにするか、UI側で検知する
        return self.team1_win is not None

    def _type_check(self, word: str) -> list[str]:
        t1, t2 = self.sb_info.get_types(word)
        types = []
        if t1: types.append(t1)
        if t2: types.append(t2)
        return types

    def _calc_damage(self, at1, at2, dt1, dt2, ability_obj, attacker: DoubleBattlePlayer, defender: DoubleBattlePlayer) -> tuple[float, int, bool]:
        effect = self.sb_info.type_effect(at1, at2, dt1, dt2)
        is_critical = ability_obj.should_force_critical([at1, at2]) if ability_obj else (random.random() < CRITICAL_HIT_CHANCE)
        
        if effect == 0:
            return 0, 0, False

        base_damage = BASE_DAMAGE_TYPED if at1 or at2 else BASE_DAMAGE_NORMAL
        damage = base_damage * effect

        # ランク補正
        atk_mult = self.sb_info.rank_to_power(attacker.attack_rank)
        def_mult = self.sb_info.rank_to_power(defender.defense_rank)
        
        damage = damage * (atk_mult / def_mult)
        
        # 乱数 (0.85 ~ 0.99)
        damage *= random.uniform(DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX)
        return effect, int(damage), is_critical

    def try_attack(self, player_id: str, word: str, target_char_id: str = None):
        if self.team1_win is not None:
            return {"type": "error", "message": "戦闘はすでに終了しています"}
            
        current_actor = self.get_current_actor()
        if player_id != current_actor.owner_id:
            return {"type": "error", "message": "自分のターンではありません"}
            
        if not word: return {"type": "error", "message": "単語を入力してください"}
        if not self.sb_info.include_in_all_words(word) and not self.sb_info.inclue_in_typed_words(word):
            return {"type": "error", "message": "辞書にない単語です"}
        if word in self.used: return {"type": "error", "message": "使用済みの単語です"}
        if word[0] != self.character: return {"type": "error", "message": "開始文字がマッチしていません"}
        if self.sb_info.get_next_initial(word) == "ん": return {"type": "error", "message": "「ん」で終わっています"}
        if not self.sb_info.include_in_typed_heads(self.sb_info.get_next_initial(word)):
            return {"type": "error", "message": "禁止された単語です"}

        # ターゲット選定: 特に指定がなければ生きている相手を適当に狙う
        target_actor = None
        enemies = self.team2 if current_actor in self.team1 else self.team1
        
        if target_char_id:
            for e in enemies:
                if e.id == target_char_id and not e.is_defeated:
                    target_actor = e
                    break
        
        if not target_actor:
            alive_enemies = [e for e in enemies if not e.is_defeated]
            if alive_enemies:
                target_actor = random.choice(alive_enemies)
            else:
                return {"type": "error", "message": "ターゲットがいません"}

        self.word = word
        types = self._type_check(word)
        current_actor.types = types[:]
        
        ability_obj = self.abilities.get(current_actor.ability)

        # ダメージ計算を代替する特性の処理
        if ability_obj and ability_obj.replaces_damage and ability_obj.check_condition(current_actor, types, word):
            # TODO: double battle specific ability implementations may be needed, but for now we reuse.
            # In battle.py, apply_damage_replacement_effect takes (player, battle). We need to pass self (DoubleBattle_info) 
            # Note: We might need to slightly adapt abilities to handle double battle context later if needed,
            # but for now we will try to reuse it as much as possible.
            try:
                ability_obj.apply_damage_replacement_effect(current_actor, self)
            except AttributeError:
                # Fallback if the ability expects a single Battle_info specifically and fails
                pass 

            self.character = self.sb_info.get_next_initial(word)
            self.used[word].append(current_actor.id)
            self._advance_turn_index()
            # skip dead players
            self.get_current_actor()
            ret = self._make_response()
            self.word = "" 
            self.events = []
            return ret

        original_attack_rank = current_actor.attack_rank
        ability_activated = False
        if ability_obj and not ability_obj.replaces_damage and ability_obj.check_condition(current_actor, types, word):
            # Same fallback handling for apply_effect
            try:
                ability_activated = ability_obj.apply_effect(current_actor, self)
            except AttributeError:
                pass


        at1 = types[0] if len(types) >= 1 else ""
        at2 = types[1] if len(types) >= 2 else ""
        dt1 = target_actor.types[0] if len(target_actor.types) >= 1 else ""
        dt2 = target_actor.types[1] if len(target_actor.types) >= 2 else ""

        if "食べ物" in types:
            limit = FOOD_LIMIT
            ignore_limit = ability_obj and ability_obj.should_ignore_food_limit()
            
            if ignore_limit or current_actor.food_count < limit:
                current_actor.food_count += 1
                cure_amount = FOOD_RECOVERY_AMOUNT
                if ability_obj:
                    cure_amount = ability_obj.get_food_recovery_amount(cure_amount)
                
                # Double battle specific event format mapping
                event = {"type": "cure", "message": f"{current_actor.name}の体力が回復した", "target": current_actor.id, "cure_amount": cure_amount}
                self.events.append(event)
                current_actor.heal(cure_amount)
            else:
                self.events.append({"type": "message", "message": f"{current_actor.name}はもう食べられない！"})
        
        elif "医療" in types:
            limit = MEDICAL_LIMIT
            if current_actor.medical_count < limit:
                current_actor.medical_count += 1
                
                # 毒解除
                if current_actor.poison_turns > 0:
                    current_actor.poison_turns = 0
                    self.events.append({"type": "cure_poison", "message": f"{current_actor.name}の毒が治った！", "target": current_actor.id})

                event = {"type": "cure", "message": f"{current_actor.name}の体力が回復した", "target": current_actor.id, "cure_amount": MEDICAL_RECOVERY_AMOUNT}
                self.events.append(event)
                current_actor.heal(MEDICAL_RECOVERY_AMOUNT)
            else:
                self.events.append({"type": "message", "message": f"{current_actor.name}はもう回復できない！"})
        
        else:
            # ダメージ計算
            effect, damage, is_critical = self._calc_damage(at1, at2, dt1, dt2, ability_obj, current_actor, target_actor)

            # 特性によるダメージ補正
            if ability_obj:
                damage = int(damage * ability_obj.get_damage_multiplier(types, word))

            # 急所補正
            if is_critical:
                damage = int(damage * CRITICAL_HIT_MULTIPLIER)

            msg = "効果はばつぐんだ！" if effect > 1 else "ふつうのダメージだ" if effect == 1 else "効果はいまひとつのようだ…" if effect > 0 else "効果はないようだ…"

            event = {
                "type": "damage",
                "message": msg,
                "target": target_actor.id,
                "damage": damage,
                "attacker": current_actor.id
            }
            self.events.append(event)

            if is_critical:
                self.events.append({
                    "type": "critical",
                    "message": "急所に当たった！"
                })

            # 防御側の特性発動チェック (一部の特性はBattle_infoを期待しているためtry-except)
            defender_ability = self.abilities.get(target_actor.ability)
            if defender_ability:
                try:
                    defender_ability.on_receive_damage(target_actor, current_actor, damage, effect, self)
                except AttributeError:
                    pass

            # 暴力で攻撃ダウン
            if "暴力" in types:
                drop = VIOLENCE_ATTACK_DROP
                if ability_obj:
                    drop -= ability_obj.get_violence_penalty_reduction()
                current_actor.attack_rank = max(MIN_RANK, current_actor.attack_rank - drop)
                msg_adverb = "がくっと" if drop >= 2 else ""
                event = {
                    "type": "stat_down",
                    "message": f"攻撃が{msg_adverb}下がった！(現在{self.sb_info.rank_to_power(current_actor.attack_rank)}倍)",
                    "target": current_actor.id,
                    "stat_type": "attack",
                    "new_rank": current_actor.attack_rank
                }
                self.events.append(event)

            target_actor.take_damage(damage)
            if target_actor.is_defeated: 
                self.events.append({"type": "message", "message": f"{target_actor.name}はたおれた！"})
                target_actor.is_active = False

        self._check_win_condition()
        
        # 次の文字
        self.character = self.sb_info.get_next_initial(word)
        self.used[word].append(current_actor.id)
        
        self.last_actor_id = current_actor.id

        # 次のターンへ
        self._advance_turn_index()
        # skip dead players for next turn pointer
        self.get_current_actor()

        ret = self._make_response()
        self.word = ""
        self.events = []
        return ret

    def _make_response(self):
        # フロントエンドに通知する情報の構築
        current_actor = self.get_current_actor()
        
        return {
            "type": "turn_result",
            "room_id": self.room_id,
            "mode": self.mode, # 1v1_double or 2v2_double
            "turn": self.turn,
            "current_actor_id": current_actor.id,
            "current_owner_id": current_actor.owner_id, # このユーザーの画面で入力UIを有効にする
            "last_actor_id": self.last_actor_id,
            "character": self.character,
            "word": self.word,
            "events": self.events,
            "team1_win": self.team1_win,
            
            # 各キャラのステータス
            "characters": {
                "p1a": self._serialize_player(self.p1a),
                "p1b": self._serialize_player(self.p1b),
                "p2a": self._serialize_player(self.p2a),
                "p2b": self._serialize_player(self.p2b),
            }
        }

    def _serialize_player(self, p: DoubleBattlePlayer):
        return {
            "id": p.id,
            "name": p.name,
            "hp": p.hp,
            "maxHp": MAX_HP,
            "attack_rank": p.attack_rank,
            "defense_rank": p.defense_rank,
            "types": p.types,
            "ability": p.ability,
            "is_defeated": p.is_defeated,
            "owner_id": p.owner_id
        }
