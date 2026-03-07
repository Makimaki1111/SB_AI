try:
    from SB_info import SB_info
except ImportError:
    from backend.SB_info import SB_info

try:
    from battle import Player, get_default_abilities, MAX_HP, FOOD_LIMIT, MEDICAL_LIMIT, MIN_RANK, MAX_RANK, FOOD_RECOVERY_AMOUNT, MEDICAL_RECOVERY_AMOUNT, CRITICAL_HIT_CHANCE, CRITICAL_HIT_MULTIPLIER, BASE_DAMAGE_NORMAL, BASE_DAMAGE_TYPED, DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX, VIOLENCE_ATTACK_DROP, LEECH_SEED_TURNS, LEECH_SEED_DRAIN_AMOUNT
except ImportError:
    from backend.battle import Player, get_default_abilities, MAX_HP, FOOD_LIMIT, MEDICAL_LIMIT, MIN_RANK, MAX_RANK, FOOD_RECOVERY_AMOUNT, MEDICAL_RECOVERY_AMOUNT, CRITICAL_HIT_CHANCE, CRITICAL_HIT_MULTIPLIER, BASE_DAMAGE_NORMAL, BASE_DAMAGE_TYPED, DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX, VIOLENCE_ATTACK_DROP, LEECH_SEED_TURNS, LEECH_SEED_DRAIN_AMOUNT

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
    def __init__(self, mode: str, team1_players: list, team2_players: list, sb_info: SB_info, room_id: str | None = None, profiles: dict = None, is_cpu: bool = False):
        self.room_id = room_id or str(uuid.uuid4())
        self.mode = mode
        self.is_cpu = is_cpu
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
        if self.is_cpu:
            self.p2a = self._create_character(team2_players[0], 'p2a', "CPU_A", profiles)
            self.p2b = self._create_character(team2_players[1] if len(team2_players) > 1 else team2_players[0], 'p2b', "CPU_B", profiles)
        else:
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
        
        # 急所判定 (暴言か人体タイプが含まれる場合、12.5%の確率)
        is_critical = False
        if ability_obj and ability_obj.should_force_critical([at1, at2]):
            is_critical = True
        elif "暴言" in [at1, at2] or "人体" in [at1, at2]:
            if random.random() < CRITICAL_HIT_CHANCE:
                is_critical = True
        
        if effect == 0:
            return 0, 0, False

        # ランク補正
        atk_mult = self.sb_info.rank_to_power(attacker.attack_rank)
        def_mult = self.sb_info.rank_to_power(defender.defense_rank)
        rank_correction = atk_mult / def_mult
        
        if is_critical:
            # 急所の場合、自分に不利な補正（< 1.0）を無視する
            rank_correction = max(1.0, rank_correction)

        damage = 0.0
        if at1 == "" and at2 == "":
            # 攻撃がノータイプ
            damage = BASE_DAMAGE_NORMAL * rank_correction
        elif dt1 == "" and dt2 == "":
            # 防御がノータイプ
            damage = BASE_DAMAGE_TYPED * effect * rank_correction
        else:
            # 攻守タイプあり
            damage = BASE_DAMAGE_TYPED * effect * rank_correction
            damage *= random.uniform(DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX)

        return effect, int(damage), is_critical

    def _is_valid_initial(self, word: str):
        return word.startswith(self.character)

    def _is_used(self, word: str):
        return word in self.used

    def _patch_ability_events(self, current_actor, target_actor):
        """特性が生成したイベントの ally/foe 形式を char_id 形式に変換する"""
        for event in self.events:
            # player: "ally"/"foe" → target: char_id
            if "player" in event and event["player"] in ("ally", "foe"):
                event["target"] = current_actor.id if event["player"] == "ally" else target_actor.id
                del event["player"]
            # poison_target: "ally"/"foe" → poison_target: char_id
            if "poison_target" in event and event["poison_target"] in ("ally", "foe"):
                event["poison_target"] = current_actor.id if event["poison_target"] == "ally" else target_actor.id
            # new_ranks: ally_atk/foe_atk 形式 → per-char 形式
            if "new_ranks" in event:
                old = event["new_ranks"]
                if "ally_atk" in old:
                    event["new_ranks"] = {
                        current_actor.id: {"attack_rank": old["ally_atk"], "defense_rank": old["ally_def"]},
                        target_actor.id: {"attack_rank": old["foe_atk"], "defense_rank": old["foe_def"]}
                    }
            # ally_damage/foe_damage 形式 → target + damage 形式
            if "ally_damage" in event:
                ally_dmg = event.pop("ally_damage", 0)
                foe_dmg = event.pop("foe_damage", 0)
                if ally_dmg > 0:
                    event["target"] = current_actor.id
                    event["damage"] = ally_dmg
                elif foe_dmg > 0:
                    event["target"] = target_actor.id
                    event["damage"] = foe_dmg
            # ally_cure/foe_cure 形式 → attacker + cure_amount 形式
            if "ally_cure" in event:
                ally_cure = event.pop("ally_cure", 0)
                foe_cure = event.pop("foe_cure", 0)
                if ally_cure > 0:
                    event["attacker"] = current_actor.id
                    event["cure_amount"] = ally_cure
                elif foe_cure > 0:
                    event["attacker"] = target_actor.id
                    event["cure_amount"] = foe_cure

    def _process_end_of_turn_effects(self, attacker, defender):
        """ターン終了時の継続効果（毒、やどりぎなど）を処理する"""
        if self.team1_win is not None:
            return

        # 毒ダメージ処理 (毒を付与したキャラクターの行動終了時に発動)
        for p in [self.p1a, self.p1b, self.p2a, self.p2b]:
            if p and not p.is_defeated and p.poison_turns > 0 and getattr(p, 'poisoner_id', None) == attacker.id:
                damage = int(MAX_HP * (p.poison_turns / 16))
                p.take_damage(damage)
                self.events.append({
                    "type": "damage",
                    "message": "毒のダメージを受けた！",
                    "target": p.id,
                    "damage": damage
                })
                p.poison_turns += 1

                if p.is_defeated:
                    self.events.append({"type": "message", "message": f"{p.name}はたおれた！"})
                    p.is_active = False

        # やどりぎ処理
        if attacker.leech_turns > 0:
            actual_defender = defender
            if hasattr(attacker, 'leech_target_id') and attacker.leech_target_id:
                for char in [self.p1a, self.p1b, self.p2a, self.p2b]:
                    if char and char.id == attacker.leech_target_id:
                        actual_defender = char
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
                    "target": actual_defender.id,
                    "damage": actual_drain,
                    "attacker": attacker.id,
                    "cure_amount": actual_drain
                })

                if actual_defender.is_defeated:
                    self.events.append({"type": "message", "message": f"{actual_defender.name}はたおれた！"})
                    actual_defender.is_active = False
            else:
                attacker.leech_turns = 0

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
        if not self._is_valid_initial(word): return {"type": "error", "message": f"「{self.character}」からはじまることばを入力してください"}
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

        # === 特性互換レイヤー ===
        # 特性クラスは battle.player1 / battle.player2 を参照するため、
        # 一時的にセットして互換性を確保する
        self.player1 = current_actor
        self.player2 = target_actor

        # ダメージ計算を代替する特性の処理
        if ability_obj and ability_obj.replaces_damage and ability_obj.check_condition(current_actor, types, word):
            ability_obj.apply_damage_replacement_effect(current_actor, self)

            # やどりぎ等のターン終了時効果処理 (single playerと同じ)
            self._process_end_of_turn_effects(current_actor, target_actor)
            self._check_win_condition()
            self._patch_ability_events(current_actor, target_actor)

            self.character = self.sb_info.get_next_initial(word)
            self.used[word].append(current_actor.id)
            self.last_actor_id = current_actor.id
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
            try:
                ability_activated = ability_obj.apply_effect(current_actor, self)
            except (AttributeError, TypeError):
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
                    current_actor.poisoner_id = None
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

            # 防御側の特性発動チェック
            defender_ability = self.abilities.get(target_actor.ability)
            if defender_ability:
                try:
                    defender_ability.on_receive_damage(target_actor, current_actor, damage, effect, self)
                except (AttributeError, TypeError):
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

        # --- 特性効果を元に戻す ---
        if ability_activated:
            current_actor.attack_rank = original_attack_rank

        # ダメージ計算後の特性効果適用 (どくばり, たいふういっか 等)
        if ability_obj and not ability_obj.replaces_damage and ability_obj.check_condition(current_actor, types, word):
            try:
                ability_obj.apply_after_effect(current_actor, self)
            except (AttributeError, TypeError):
                pass

        # ターン終了時効果（毒、やどりぎ等）
        self._process_end_of_turn_effects(current_actor, target_actor)
        self._check_win_condition()

        # 特性が生成したイベントを修正 (ally/foe → char_id)
        self._patch_ability_events(current_actor, target_actor)
        
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

    def get_cpu_word(self):
        candidates = self.sb_info.get_typed_word_candidates(self.character)
        for word in candidates:
            if not self._is_used(word):
                return word
        return ""

    def execute_cpu_turn(self):
        actor = self.get_current_actor()
        cpu_word = self.get_cpu_word()
        if cpu_word:
            # CPUは生存している敵陣のターゲットをランダムに狙う
            valid_targets = [p.id for p in self.team1 if not p.is_defeated]
            if not valid_targets:
                self.team1_win = False
                return self._make_response()
            target_id = random.choice(valid_targets)
            return self.try_attack(actor.owner_id, cpu_word, target_char_id=target_id)
        else:
            # 降参扱い
            actor.hp = 0
            self.events.append({"text": f"{actor.name}は ことばを思いつかなかった！", "character_id": actor.id})
            if self._check_win_condition():
                self.events.append({"text": "チーム1の勝利！" if self.team1_win else "チーム2の勝利！", "character_id": "system"})
            else:
                self._advance_turn_index()
            return self._make_response()

    def include_check(self, word: str):
        """入力中の単語のタイプチェック（ダブルバトル用）"""
        ret = {
            "type": "pre_check",
            "name": word,
            "include": False,
            "used": False,
            "type1": "",
            "type2": "",
        }

        if not word:
            return ret

        if word in self.used:
            ret["include"] = True
            ret["used"] = True
            # usedはdefaultdict(list)なので、タイプを取得
            types = self.sb_info.get_types(word) if self.sb_info.inclue_in_typed_words(word) else [""]
            ret["type1"] = types[0] if len(types) >= 1 else ""
            ret["type2"] = types[1] if len(types) >= 2 else ""
        else:
            ret["include"] = self.sb_info.include_in_all_words(word)

        return ret

    def timeout(self):
        """
        タイムアウト処理:
        現在行動中キャラクターの所属チームを敗北扱いにする。
        """
        if self.team1_win is not None:
            return self._make_response()

        current_actor = self.get_current_actor()
        timed_out_team = self.team1 if current_actor in self.team1 else self.team2

        for p in timed_out_team:
            if p.is_defeated:
                continue
            dmg = p.hp
            p.take_damage(dmg)
            self.events.append({
                "type": "damage",
                "message": f"時間切れ！{p.name}は倒れた！",
                "target": p.id,
                "damage": dmg
            })

        self._check_win_condition()
        ret = self._make_response()
        self.events = []
        return ret

    def change_ability(self, char_id: str, new_ability_id: str):
        """キャラクターの特性を変更する"""
        char = getattr(self, char_id, None)
        if not char:
            return {"type": "error", "message": "存在しないキャラクターです"}

        if char.ability_change_count <= 0:
            return {"type": "error", "message": "特性はもう変更できません"}

        if new_ability_id not in self.abilities:
            return {"type": "error", "message": "存在しない特性です"}

        if new_ability_id == char.ability:
            return {"type": "error", "message": "現在の特性と同じです"}

        char.ability_change_count -= 1
        char.ability = new_ability_id

        ability_display_name = self.abilities[new_ability_id].name

        event = {
            "type": "ability_changed",
            "message": f"{char.name}の特性が「{ability_display_name}」に変わった！ (残り変更回数: {char.ability_change_count})",
            "char_id": char.id,
            "new_ability": new_ability_id,
            "new_ability_change_count": char.ability_change_count
        }
        self.events.append(event)

        res = self._make_response()
        return res

    def _make_response(self):
        # フロントエンドに通知する情報の構築
        current_actor = self.get_current_actor()
        
        return {
            "type": "turn_result",
            "room_id": self.room_id,
            "mode": self.mode, # 1v1_double or 2v2_double
            "is_cpu": self.is_cpu,
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
            "ability_change_count": p.ability_change_count,
            "is_defeated": p.is_defeated,
            "is_poison": p.poison_turns > 0,
            "owner_id": p.owner_id
        }

    def get_personalized_response(self, base_res: dict, request_player_id: str) -> dict:
        import copy
        new_res = copy.deepcopy(base_res)
        
        # Check if requesting player is on team1
        is_t1 = any(p.owner_id == request_player_id for p in self.team1)
        
        if "characters" in new_res:
            chars = new_res["characters"]
            for k in ["p1a", "p1b", "p2a", "p2b"]:
                if k in chars:
                    char_info = chars[k]
                    # Hide opponent abilities
                    if is_t1 and k in ["p2a", "p2b"]:
                        char_info.pop("ability", None)
                    elif not is_t1 and k in ["p1a", "p1b"]:
                        char_info.pop("ability", None)

        # Hide enemy-team ability change notifications.
        if "events" in new_res and isinstance(new_res["events"], list):
            masked_events = []
            for e in new_res["events"]:
                if e.get("type") == "ability_changed":
                    changed_id = e.get("char_id")
                    if is_t1 and changed_id in ["p2a", "p2b"]:
                        continue
                    if (not is_t1) and changed_id in ["p1a", "p1b"]:
                        continue
                masked_events.append(e)
            new_res["events"] = masked_events
        return new_res

    def handle_disconnection(self, disconnected_player_id: str, message: str = "あいてが通信を切断しました。"):
        """
        プレイヤーが切断または逃亡した際の処理。
        切断したプレイヤーが所有するキャラクターを戦闘不能（HP=0）にする。
        その結果、勝敗が確定した場合は結果のレスポンスを返す。
        """
        if self.team1_win is not None:
            return None # 既に勝負がついている場合は何もしない

        disconnected_chars = []
        for p in self.team1 + self.team2:
            if p.owner_id == disconnected_player_id and not p.is_defeated:
                p.hp = 0
                p.is_active = False
                disconnected_chars.append(p)

        if not disconnected_chars:
            return None

        # イベントの追加
        for p in disconnected_chars:
            self.events.append({
                "type": "message",
                "message": f"{p.name} は逃げ出した！"
            })

        self.events.append({
            "type": "error",
            "message": message
        })

        # 勝敗チェック
        self._check_win_condition()
        
        # 進行中のターンのキャラが逃げた場合、次のキャラにターンを回すための処理
        current_actor = self.get_current_actor()

        ret = self._make_response()
        self.events = []
        return ret
