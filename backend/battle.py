try:
    from SB_info import SB_info
    from GOOGLE_API import GOOGLE_AI
except ImportError:
    from backend.SB_info import SB_info
    from backend.GOOGLE_API import GOOGLE_AI

from collections import defaultdict
from pydantic import BaseModel
import random
import uuid
battle_rooms = {}
MAX_HP = 60
FOOD_LIMIT = 6
MEDICAL_LIMIT = 5

class TextInput(BaseModel):
    text:str

class Player:
    """プレイヤーの状態を管理するクラス"""
    def __init__(self, player_id: str, name: str):
        self.id = player_id
        self.name = name
        self.hp = MAX_HP
        self.attack_rank = 0
        self.defense_rank = 0
        self.types = [""]
        self.ability = "" # 特性
        self.ability_change_count = 3 # 特性変更の残り回数
        self.leech_turns = 0 # やどりぎの残りターン数
        self.food_count = 0 # 食べ物使用回数
        self.medical_count = 0 # 医療使用回数

    def take_damage(self, damage: int):
        self.hp = max(0, self.hp - damage)

    def heal(self, amount: int):
        self.hp = min(MAX_HP, self.hp + amount)

    @property
    def is_defeated(self) -> bool:
        return self.hp <= 0

class Ability:
    """特性の基底クラス"""
    def __init__(self, name: str, description: str, icon_type: str):
        self.name = name
        self.description = description
        self.icon_type = icon_type
        self.replaces_damage = False

    def get_display_data(self) -> dict:
        """フロントエンドに渡すためのデータを返す"""
        return {
            "name": self.name,
            "description": self.description,
            "icon_type": self.icon_type,
        }

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        """特性の発動条件をチェックする"""
        return False

    def apply_effect(self, player: Player, battle: 'Battle_info') -> bool:
        """攻撃後の効果を適用し、発動したかどうかを返す"""
        return False

    def apply_after_effect(self, player: Player, battle: 'Battle_info'):
        """ダメージ計算・表示後に適用する効果"""
        pass

    def apply_damage_replacement_effect(self, player: Player, battle: 'Battle_info'):
        """ダメージ計算を代替する効果を適用する"""
        pass

    def get_violence_penalty_reduction(self) -> int:
        """暴力タイプ使用時の攻撃力ダウン軽減量を返す"""
        return 0

    def get_damage_multiplier(self, types: list, word: str) -> float:
        """ダメージ計算時の倍率補正を返す"""
        return 1.0

    def get_food_recovery_amount(self, default_amount: int) -> int:
        """食べ物タイプ使用時の回復量を返す"""
        return default_amount

    def should_ignore_food_limit(self) -> bool:
        """食べ物の回数制限を無視するかどうか"""
        return False

    def on_receive_damage(self, player: Player, attacker: Player, damage: int, effect: float, battle: 'Battle_info'):
        """ダメージを受けた時の効果"""
        pass

class StatBoostAbility(Ability):
    """特定の条件で攻撃ランクを上昇させる特性の共通クラス"""
    def __init__(self, name: str, description: str, icon_type: str, condition_types: list = [], min_word_len: int = 0):
        super().__init__(name, description, icon_type)
        self._condition_types = condition_types
        self._min_word_len = min_word_len

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        if self._condition_types and any(t in types for t in self._condition_types):
            return True
        if self._min_word_len > 0 and len(word) >= self._min_word_len:
            return True
        return False

    def apply_effect(self, player: Player, battle: 'Battle_info') -> bool:
        player.attack_rank = min(6, player.attack_rank + 2)
        event = {
            "type": "atk_up",
            "message": f"攻撃がぐーんと上がった！",
            "player": "ally" if player.id == battle.player1.id else "foe"
        }
        battle.events.append(event)
        return True

class TypeStatBoostAbility(Ability):
    """特定タイプでダメージの代わりにステータスランクを上げる汎用特性"""
    def __init__(self, name: str, description: str, icon_type: str, target_type: str, boost_amount: int, stat_type: str = "attack"):
        super().__init__(name, description, icon_type)
        self.replaces_damage = True
        self.target_type = target_type
        self.boost_amount = boost_amount
        self.stat_type = stat_type

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        return self.target_type in types

    def apply_damage_replacement_effect(self, player: Player, battle: 'Battle_info'):
        if self.stat_type == "defense":
            player.defense_rank = min(6, player.defense_rank + self.boost_amount)
            current_rank = player.defense_rank
            stat_name = "防御"
        else:
            player.attack_rank = min(6, player.attack_rank + self.boost_amount)
            current_rank = player.attack_rank
            stat_name = "攻撃"
        
        # 上昇量に応じてメッセージを微調整
        msg_adverb = "ぐーんと" if self.boost_amount >= 2 else ""
        
        event = {
            "type": "stat_up",
            "message": f"{stat_name}が{msg_adverb}上がった！(現在{battle.sb_info.rank_to_power(current_rank):.1f}倍)",
            "player": "ally" if player.id == battle.player1.id else "foe"
        }
        battle.events.append(event)

class TypePowerUpAbility(Ability):
    """特定タイプの単語でダメージ倍率を上げる"""
    def __init__(self, name: str, description: str, icon_type: str, target_type: str, damage_multiplier: float = 1.5):
        super().__init__(name, description, icon_type)
        self.target_type = target_type
        self.damage_multiplier = damage_multiplier

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        return self.target_type in types

    def apply_effect(self, player: Player, battle: 'Battle_info') -> bool:
        return False

    def get_damage_multiplier(self, types: list, word: str) -> float:
        if self.target_type in types:
            return self.damage_multiplier
        return 1.0

class MukimukiAbility(Ability):
    """特性「むきむき」"""
    def __init__(self):
        super().__init__(
            name="むきむき",
            description="暴力タイプの言葉を使っても攻撃力がすこししか下がらなくなる",
            icon_type="暴力"
        )

    def get_violence_penalty_reduction(self) -> int:
        return 1

class LeechSeedAbility(Ability):
    """特性「やどりぎ」"""
    def __init__(self):
        super().__init__(
            name="やどりぎ",
            description="植物タイプの言葉を使うとダメージを与える代わりに相手にやどりぎを植え付ける",
            icon_type="植物"
        )
        self.replaces_damage = True

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        # 既にやどりぎ中の場合は発動しない（通常攻撃になる）
        return "植物" in types and player.leech_turns == 0

    def apply_damage_replacement_effect(self, player: Player, battle: 'Battle_info'):
        player.leech_turns = 4
        battle.events.append({"type": "ability_trigger", "message": f"相手に種を植え付けた！", "player": "ally" if player.id == battle.player1.id else "foe"})

class LongWordBonusAbility(Ability):
    """特性「おれのことばのもじすうがおおいほどいりょくがおおきくなるけんについて」"""
    def __init__(self):
        super().__init__(
            name="おれのことばのもじすうがおおいほどいりょくがおおきくなるけんについて",
            description="言葉の文字数が多いほど威力が大きくなる",
            icon_type="物語"
        )

    def get_damage_multiplier(self, types: list, word: str) -> float:
        length = len(word)
        if length >= 7:
            return 2.0
        elif length == 6:
            return 1.5
        return 1.0

class RevolutionAbility(Ability):
    """特性「かくめい」"""
    def __init__(self):
        super().__init__(
            name="かくめい",
            description="遊びタイプの言葉を使うたびに自分と相手の能力変化をひっくり返す",
            icon_type="遊び"
        )

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        return "遊び" in types

    def apply_after_effect(self, player: Player, battle: 'Battle_info'):
        # 自分と相手を取得
        opponent = battle.player2 if player.id == battle.player1.id else battle.player1

        # ランク反転
        player.attack_rank *= -1
        player.defense_rank *= -1
        opponent.attack_rank *= -1
        opponent.defense_rank *= -1

        event = {
            "type": "ability_trigger",
            "message": f"全ての能力変化がひっくり返った！",
            "player": "ally" if player.id == battle.player1.id else "foe",
            "new_ranks": {
                "ally_atk": battle.player1.attack_rank,
                "ally_def": battle.player1.defense_rank,
                "foe_atk": battle.player2.attack_rank,
                "foe_def": battle.player2.defense_rank
            }
        }
        battle.events.append(event)

class TyphoonIkkaAbility(Ability):
    """特性「たいふういっか」"""
    def __init__(self):
        super().__init__(
            name="たいふういっか",
            description="天気タイプの言葉を使うと自分と相手の能力変化をもとに戻す",
            icon_type="天気"
        )

    def check_condition(self, player: Player, types: list, word: str) -> bool:
        return "天気" in types

    def apply_after_effect(self, player: Player, battle: 'Battle_info'):
        # 自分と相手を取得
        opponent = battle.player2 if player.id == battle.player1.id else battle.player1

        # ランクをリセット
        player.attack_rank = 0
        player.defense_rank = 0
        opponent.attack_rank = 0
        opponent.defense_rank = 0

        event = {
            "type": "ability_trigger",
            "message": f"すべての能力変化が元に戻った！",
            "player": "ally" if player.id == battle.player1.id else "foe",
            "new_ranks": {
                "ally_atk": battle.player1.attack_rank,
                "ally_def": battle.player1.defense_rank,
                "foe_atk": battle.player2.attack_rank,
                "foe_def": battle.player2.defense_rank
            }
        }
        battle.events.append(event)

class IkasuiAbility(Ability):
    """特性「いかすい」"""
    def __init__(self):
        super().__init__(
            name="いかすい",
            description="いくらでも食べることができる",
            icon_type="食べ物"
        )

    def should_ignore_food_limit(self) -> bool:
        return True

class IshokudogenAbility(Ability):
    """特性「いしょくどうげん」"""
    def __init__(self):
        super().__init__(
            name="いしょくどうげん",
            description="食べ物タイプの言葉で医療タイプと同じ効果が得られる",
            icon_type="医療"
        )

    def get_food_recovery_amount(self, default_amount: int) -> int:
        return 40

class HokenAbility(Ability):
    """特性「ほけん」"""
    def __init__(self):
        super().__init__(
            name="ほけん",
            description="効果抜群のダメージを受けると攻撃力がぐぐーんと上がる",
            icon_type="社会"
        )

    def on_receive_damage(self, player: Player, attacker: Player, damage: int, effect: float, battle: 'Battle_info'):
        if effect > 1:
            player.attack_rank = min(6, player.attack_rank + 3)
            event = {
                "type": "atk_up",
                "message": f"弱点を突かれて攻撃がぐぐーんと上がった！(現在{battle.sb_info.rank_to_power(player.attack_rank):.1f}倍)",
                "player": "ally" if player.id == battle.player1.id else "foe",
                "new_atk": player.attack_rank
            }
            battle.events.append(event)

class Battle_info:
    """
    ブラウザ対戦時のマッチ情報を保持するクラス
    """
    def __init__(self, player1_id, player2_id, sb_info: SB_info, google_ai: GOOGLE_AI, room_id: str | None = None):
        self.room_id = room_id or str(uuid.uuid4())
        self.used = defaultdict(list)
        self.MAX_HP = 60
        self.is_cpu = (player2_id == "cpu")

        self.sb_info = sb_info
        self.google_ai = google_ai

        self.player1 = Player(player1_id, "じぶん")
        self.player2 = Player(player2_id, "あいて")

        # 特性関連
        self.abilities = {
            "passion": TypeStatBoostAbility(
                name="じょうねつ",
                description="感情タイプの言葉を使うとダメージを与える代わりに攻撃力が上がる",
                icon_type="感情",
                target_type="感情",
                boost_amount=1
            ),
            "rocknroll": TypeStatBoostAbility(
                name="ロックンロール",
                description="芸術タイプの言葉を使うとダメージを与える代わりに攻撃力がぐーんと上がる",
                icon_type="芸術",
                target_type="芸術",
                boost_amount=2
            ),
            "training": TypeStatBoostAbility(
                name="トレーニング",
                description="スポーツタイプの言葉を使うとダメージを与える代わりに攻撃力が上がる",
                icon_type="スポーツ",
                target_type="スポーツ",
                boost_amount=1
            ),
            "procrastination": TypeStatBoostAbility(
                name="さきのばし",
                description="時間タイプの言葉を使うとダメージを与える代わりに防御力が上がる",
                icon_type="時間",
                target_type="時間",
                boost_amount=1,
                stat_type="defense"
            ),
            "kachikochi": TypeStatBoostAbility(
                name="かちこち",
                description="機械タイプの言葉を使うとダメージを与える代わりに防御力が上がる",
                icon_type="機械",
                target_type="機械",
                boost_amount=1,
                stat_type="defense"
            ),
            "calculation": TypeStatBoostAbility(
                name="けいさん",
                description="数学タイプの言葉を使うとダメージを与える代わりに攻撃力が上がる",
                icon_type="数学",
                target_type="数学",
                boost_amount=1
            ),
            "layering": TypeStatBoostAbility(
                name="かさねぎ",
                description="服飾タイプの言葉を使うとダメージを与える代わりに防御力が上がる",
                icon_type="服飾",
                target_type="服飾",
                boost_amount=1,
                stat_type="defense"
            ),
            "arming": TypeStatBoostAbility(
                name="ぶそう",
                description="工作タイプの言葉を使うとダメージを与える代わりに攻撃力が上がる",
                icon_type="工作",
                target_type="工作",
                boost_amount=1
            ),
            "kyojin": TypePowerUpAbility(
                name="きょじん",
                description="人物タイプの言葉の威力が上がる",
                icon_type="人物",
                target_type="人物",
                damage_multiplier=1.5
            ),
            "jikken": TypePowerUpAbility(
                name="じっけん",
                description="理科タイプの言葉の威力が上がる",
                icon_type="理科",
                target_type="理科",
                damage_multiplier=1.5
            ),
            "global": TypePowerUpAbility(
                name="グローバル",
                description="地名タイプの言葉の威力が上がる",
                icon_type="地名",
                target_type="地名",
                damage_multiplier=1.5
            ),
            "shinkoushin": TypePowerUpAbility(
                name="しんこうしん",
                description="宗教タイプの言葉の威力が上がる",
                icon_type="宗教",
                target_type="宗教",
                damage_multiplier=1.5
            ),
            "ikasui": IkasuiAbility(),
            "ishokudogen": IshokudogenAbility(),
            "hoken": HokenAbility(),
            "mukimuki": MukimukiAbility(),
            "yadorigi": LeechSeedAbility(),
            "long_word": LongWordBonusAbility(),
            "revolution": RevolutionAbility(),
            "taifuikka": TyphoonIkkaAbility()
        }
        self.ability_ids = list(self.abilities.keys())
        self.player1.ability = random.choice(self.ability_ids)
        self.player2.ability = random.choice(self.ability_ids)

        self.player1_win = None
        self.player1_turn = True
        self.START_CHARACTER = "あいうえおかきくけこさしすせそたちつてとなにねのはひふへほまみむめやゆよらりるれろわ"
        self.character = random.choice(self.START_CHARACTER)
        self.events = []
        self.turn = 0
        self.word = ""

    def _get_serializable_abilities(self):
        """
        フロントエンドに渡すための、JSONシリアライズ可能な特性データの辞書を作成する。
        """
        serializable_abilities = {}
        for ability_id, ability_obj in self.abilities.items():
            serializable_abilities[ability_id] = ability_obj.get_display_data()
        return serializable_abilities

    def try_attack(self, player_id, word: str):
        """player1に返す用のメッセージ

        Args:
            player_id (_type_): _description_
            word (_type_): _description_

        Returns:
            _type_: _description_
        """
        if(self.player1_win != None):
            return {"type" : "error", "message" : "戦闘はすでに終了しています"}
        elif(self.player1_turn ^ (player_id == self.player1.id)):
            return {"type" : "error", "message" : "自分のターンではありません"}
        elif(not self.sb_info.include_in_all_words(word) and not self.sb_info.inclue_in_typed_words(word)):
            return {"type" : "error", "message" : "辞書にない単語です"}
        elif(word in self.used):
            return {"type" : "error", "message" : "使用済みの単語です"}
        elif(word[0] != self.character):
            return {"type" : "error", "message" : "開始文字がマッチしていません"}
        elif(self.sb_info.get_next_initial(word) == "ん"):
            return {"type" : "error", "message" : "「ん」で終わっています"}
        elif(not self.sb_info.include_in_typed_heads( self.sb_info.get_next_initial(word) )):
            return {"type" : "error", "message" : "禁止された単語です"}

        self.word = word
        types = self._type_check(word)

        # --- 特性処理 ---
        current_player = self.player1 if self.player1_turn else self.player2
        ability_obj = self.abilities.get(current_player.ability)

        # ダメージ計算を代替する特性の処理
        if ability_obj and ability_obj.replaces_damage and ability_obj.check_condition(current_player, types, word):
            current_player.types = types[:] # フロントエンド表示用にタイプを更新
            ability_obj.apply_damage_replacement_effect(current_player, self)
            
            # やどりぎ等のターン終了時効果処理
            self._process_end_of_turn_effects(current_player, self.player2 if self.player1_turn else self.player1)

            self.character = self.sb_info.get_next_initial(word)
            ret = self._make_response()
            self.word = "" # レスポンス生成後に単語をリセット
            self.player1_turn = not self.player1_turn
            self.turn += 1
            return ret

        original_attack_rank = current_player.attack_rank
        ability_activated = False
        if ability_obj and not ability_obj.replaces_damage and ability_obj.check_condition(current_player, types, word):
            ability_activated = ability_obj.apply_effect(current_player, self)

        if(player_id == self.player1.id):
            # タイプ特定
            self.player1.types = types[:]
            at1 = types[0] if len(types) >= 1 else ""
            at2 = types[1] if len(types) >= 2 else ""
            dt1 = self.player2.types[0] if len(self.player2.types) >= 1 else ""
            dt2 = self.player2.types[1] if len(self.player2.types) >= 2 else ""
            
            if("食べ物" in types):
                limit = FOOD_LIMIT
                ignore_limit = ability_obj and ability_obj.should_ignore_food_limit()
                
                if ignore_limit or self.player1.food_count < limit:
                    self.player1.food_count += 1
                    cure_amount = 20
                    if ability_obj:
                        cure_amount = ability_obj.get_food_recovery_amount(cure_amount)
                    event = {"type" : "cure", "message" : "体力が回復した", "ally_cure" : cure_amount, "foe_cure" : 0}
                    self.events.append(event)
                    self.player1.heal(cure_amount)
                else:
                    self.events.append({"type" : "message", "message" : "もう食べられない！"})
            elif("医療" in types):
                limit = MEDICAL_LIMIT
                if self.player1.medical_count < limit:
                    self.player1.medical_count += 1
                    event = {"type" : "cure", "message" : "体力が回復した", "ally_cure" : 40, "foe_cure" : 0}
                    self.events.append(event)
                    self.player1.heal(40)
                else:
                    self.events.append({"type" : "message", "message" : "もう回復できない！"})
            else:
                # ダメージ計算
                effect, damage = self._calc_damage(at1,at2,dt1,dt2)

                # 特性によるダメージ補正
                if ability_obj:
                    damage = int(damage * ability_obj.get_damage_multiplier(types, word))

                event = {
                    "type" : "damage",
                    "message" : "効果はばつぐんだ！" if effect > 1 else "ふつうのダメージだ" if effect == 1 else "効果はいまひとつのようだ…" if effect > 0 else "効果はないようだ…",
                    "ally_damage" : 0,
                    "foe_damage" : damage
                }
                self.events.append(event)

                # 防御側の特性発動チェック
                defender_ability = self.abilities.get(self.player2.ability)
                if defender_ability:
                    defender_ability.on_receive_damage(self.player2, self.player1, damage, effect, self)

                # 暴力で攻撃ダウン
                if("暴力" in types):
                    drop = 2
                    if ability_obj:
                        drop -= ability_obj.get_violence_penalty_reduction()
                    self.player1.attack_rank = max(-6, self.player1.attack_rank - drop)
                    msg_adverb = "がくっと" if drop >= 2 else ""
                    event = {
                        "type" : "atk_down",
                        "message" : f"攻撃が{msg_adverb}下がった！(現在{self.sb_info.rank_to_power(self.player1.attack_rank)}倍)",
                        "player" : "ally",
                        "new_atk" : self.player1.attack_rank
                    }
                    self.events.append(event)

                self.player2.take_damage(damage)
                if(self.player2.is_defeated): self.player1_win = True

        else:
            # タイプ特定
            self.player2.types = types[:]
            at1 = types[0] if len(types) >= 1 else ""
            at2 = types[1] if len(types) >= 2 else ""
            dt1 = self.player1.types[0] if len(self.player1.types) >= 1 else ""
            dt2 = self.player1.types[1] if len(self.player1.types) >= 2 else ""

            if("食べ物" in types):
                limit = FOOD_LIMIT
                ignore_limit = ability_obj and ability_obj.should_ignore_food_limit()
                
                if ignore_limit or self.player2.food_count < limit:
                    self.player2.food_count += 1
                    cure_amount = 20
                    if ability_obj:
                        cure_amount = ability_obj.get_food_recovery_amount(cure_amount)
                    event = {"type" : "cure", "message" : "体力が回復した", "ally_cure" : 0, "foe_cure" : cure_amount}
                    self.events.append(event)
                    self.player2.heal(cure_amount)
                else:
                    self.events.append({"type" : "message", "message" : "もう食べられない！"})

            elif("医療" in types):
                limit = MEDICAL_LIMIT
                if self.player2.medical_count < limit:
                    self.player2.medical_count += 1
                    event = {"type" : "cure", "message" : "体力が回復した", "ally_cure" : 0, "foe_cure" : 40}
                    self.events.append(event)
                    self.player2.heal(40)
                else:
                    self.events.append({"type" : "message", "message" : "もう回復できない！"})
            else:
                # ダメージ計算
                effect, damage = self._calc_damage(at1,at2,dt1,dt2)

                # 特性によるダメージ補正
                if ability_obj:
                    damage = int(damage * ability_obj.get_damage_multiplier(types, word))

                event = {
                    "type" : "damage",
                    "message" : "効果はばつぐんだ！" if effect > 1 else "ふつうのダメージだ" if effect == 1 else "効果はいまひとつのようだ…" if effect > 0 else "効果はないようだ…",
                    "ally_damage" : damage,
                    "foe_damage" : 0
                }
                self.events.append(event)

                # 防御側の特性発動チェック
                defender_ability = self.abilities.get(self.player1.ability)
                if defender_ability:
                    defender_ability.on_receive_damage(self.player1, self.player2, damage, effect, self)

                # 暴力で攻撃ダウン
                if("暴力" in types):
                    drop = 2
                    if ability_obj:
                        drop -= ability_obj.get_violence_penalty_reduction()
                    self.player2.attack_rank = max(-6, self.player2.attack_rank - drop)
                    msg_adverb = "がくっと" if drop >= 2 else ""
                    event = {
                        "type" : "atk_down",
                        "message" : f"攻撃が{msg_adverb}下がった！(現在{self.sb_info.rank_to_power(self.player2.attack_rank)}倍)",
                        "player" : "foe",
                        "new_atk" : self.player2.attack_rank
                    }
                    self.events.append(event)

                self.player1.take_damage(damage)
                if(self.player1.is_defeated): self.player1_win = False

        # --- 特性効果を元に戻す ---
        if ability_activated:
            current_player.attack_rank = original_attack_rank

        # ダメージ計算後の特性効果適用
        if ability_obj and not ability_obj.replaces_damage and ability_obj.check_condition(current_player, types, word):
            ability_obj.apply_after_effect(current_player, self)

        # やどりぎ等のターン終了時効果処理
        self._process_end_of_turn_effects(current_player, self.player2 if self.player1_turn else self.player1)

        self.character = self.sb_info.get_next_initial(word)
        ret = self._make_response()
        self.word = "" # レスポンス生成後に単語をリセット

        # ターン交代
        self.player1_turn = not self.player1_turn
        self.turn += 1
        return ret

    def _process_end_of_turn_effects(self, attacker: Player, defender: Player):
        """ターン終了時の継続効果（やどりぎなど）を処理する"""
        # 勝敗が決まっている場合は処理しない
        if self.player1_win is not None:
            return

        # やどりぎ処理
        if attacker.leech_turns > 0:
            drain_amount = 5
            actual_drain = min(defender.hp, drain_amount)
            
            defender.take_damage(actual_drain)
            attacker.heal(actual_drain)
            attacker.leech_turns -= 1

            # 吸収イベント（ダメージと回復を同時に行う）
            self.events.append({
                "type": "drain",
                "message": "やどりぎで体力を奪った！",
                "ally_damage": 0 if attacker.id == self.player1.id else actual_drain,
                "foe_damage": actual_drain if attacker.id == self.player1.id else 0,
                "ally_cure": actual_drain if attacker.id == self.player1.id else 0,
                "foe_cure": 0 if attacker.id == self.player1.id else actual_drain
            })

            if defender.is_defeated:
                self.player1_win = (attacker.id == self.player1.id)

    def include_check(self,_input:str):
        ret = {
            "type" : "pre_check",
            "name" : _input,
            "include" : False, 
            "used" : False,
            "type1" : "",
            "type2" : "",
        }

        if(_input in self.used):
            ret["include"] = True
            ret["used"] = True
            ret["type1"] = self.used[_input][0]
            ret["type2"] = self.used[_input][1] if len(self.used[_input]) == 2 else ""
        else:
            ret["include"] = self.sb_info.include_in_all_words(_input)

        return ret

    def _type_check(self,_input:str) -> list:
        """
            AIにタイプを確認 & used更新
        Args:
            _input (str): 単語

        Returns:
            タイプ (list)
        """
        types = self.google_ai.get_type(_input)
        self.used[_input] = types

        return types

    def _calc_damage(self,at1:str, at2:str, dt1:str, dt2:str) -> tuple:
        """
            ダメージを計算します
        Args:
            at1 (str): 攻撃タイプ1
            at2 (str): 攻撃タイプ2
            dt1 (str): 防御タイプ1
            dt2 (str): 防御タイプ2

        Returns:
            tuple: (相性, ダメージ)
        """
        e = self.sb_info.type_effect(at1,at2,dt1,dt2)
        if(at1 == at2 == ""):
            # 攻撃がノータイプ
            damage = 7.0
            if(self.player1_turn):
                damage *= self.sb_info.rank_to_power(self.player1.attack_rank)
                damage /= self.sb_info.rank_to_power(self.player2.defense_rank)
            else:
                damage *= self.sb_info.rank_to_power(self.player2.attack_rank)
                damage /= self.sb_info.rank_to_power(self.player1.defense_rank)
            return e, int(damage)
        elif(dt1 == dt2 == ""):
            # 防御がノータイプ
            damage = 10.0 * e
            if(self.player1_turn):
                damage *= self.sb_info.rank_to_power(self.player1.attack_rank)
                damage /= self.sb_info.rank_to_power(self.player2.defense_rank)
            else:
                damage *= self.sb_info.rank_to_power(self.player2.attack_rank)
                damage /= self.sb_info.rank_to_power(self.player1.defense_rank)
            return e, int(damage)
        else:
            # 攻守タイプあり
            damage = 10.0 * e
            if(self.player1_turn):
                damage *= self.sb_info.rank_to_power(self.player1.attack_rank)
                damage /= self.sb_info.rank_to_power(self.player2.defense_rank)
            else:
                damage *= self.sb_info.rank_to_power(self.player2.attack_rank)
                damage /= self.sb_info.rank_to_power(self.player1.defense_rank)
            damage *= random.uniform(0.85,0.99)
            return e, int(damage)

    def _make_response(self) -> dict:
        """
            frontend側に返す辞書を作成します
        Returns:
            dict: 返す情報
        """
        ret = {
            "type": "accepted",
            "state" : {
                "ally_HP" : self.player1.hp,
                "ally_A" : self.player1.attack_rank,
                "ally_B" : self.player1.defense_rank,
                "ally_type" : self.player1.types,
                "ally_ability": self.player1.ability,
                "ally_ability_change_count": self.player1.ability_change_count,
                "ally_win" : self.player1_win,
                "ally_is_attacker" : None,
                "character" : self.character,
                "events" : self.events[:],
                "foe_HP" : self.player2.hp,
                "foe_A" : self.player2.attack_rank,
                "foe_B" : self.player2.defense_rank,
                "foe_type" : self.player2.types,
                "foe_ability": self.player2.ability,
                "foe_ability_change_count": self.player2.ability_change_count,
                "room_id" : self.room_id,
                "is_cpu" : self.is_cpu,
                "is_my_turn" : self.player1_turn,
                "turn" : self.turn,
                "word" : self.word
            }
        }

        self.events = []
        return ret

    def make_init_response(self, player_id: str) -> dict:
        """
        ゲーム開始時のレスポンスを作成する（視点対応）
        """
        is_p1 = (player_id == self.player1.id)
        
        ally = self.player1 if is_p1 else self.player2
        foe = self.player2 if is_p1 else self.player1

        return {
            "type": "made_room",
            "message": "バトルルーム作成",
            "room_id": self.room_id,
            "all_abilities": self._get_serializable_abilities(),
            "state" : {
                "is_my_turn" : self.player1_turn if is_p1 else not self.player1_turn,
                "character" : self.character
            },
            "ally" : {
                "max_hp" : self.MAX_HP,
                "name" : ally.name,
                "ability": ally.ability,
                "ability_change_count": ally.ability_change_count
            },
            "foe" : {
                "max_hp" : self.MAX_HP,
                "name" : foe.name,
                "ability": foe.ability,
                "ability_change_count": foe.ability_change_count
            }
        }

    @staticmethod
    def flip_turn_response(response: dict) -> dict:
        """
        Player1視点のレスポンスをPlayer2視点に変換する
        """
        if response.get("type") != "accepted":
            return response
        
        s = response["state"]
        new_state = s.copy()

        # ステータスの入れ替え
        new_state["ally_HP"] = s["foe_HP"]
        new_state["ally_A"] = s["foe_A"]
        new_state["ally_B"] = s["foe_B"]
        new_state["ally_type"] = s["foe_type"]
        new_state["ally_ability"] = s["foe_ability"]
        new_state["ally_ability_change_count"] = s["foe_ability_change_count"]
        
        new_state["foe_HP"] = s["ally_HP"]
        new_state["foe_A"] = s["ally_A"]
        new_state["foe_B"] = s["ally_B"]
        new_state["foe_type"] = s["ally_type"]
        new_state["foe_ability"] = s["ally_ability"]
        new_state["foe_ability_change_count"] = s["ally_ability_change_count"]

        # ターンと勝敗の反転
        new_state["is_my_turn"] = not s["is_my_turn"]
        new_state["ally_win"] = not s["ally_win"] if s["ally_win"] is not None else None

        # イベントの視点反転
        new_events = []
        for e in s["events"]:
            ne = e.copy()
            if "ally_damage" in e: ne["ally_damage"] = e["foe_damage"]
            if "foe_damage" in e: ne["foe_damage"] = e["ally_damage"]
            if "ally_cure" in e: ne["ally_cure"] = e["foe_cure"]
            if "foe_cure" in e: ne["foe_cure"] = e["ally_cure"]
            if "player" in e: ne["player"] = "foe" if e["player"] == "ally" else "ally"
            if "new_ranks" in e:
                nr = e["new_ranks"].copy()
                nr["ally_atk"] = e["new_ranks"]["foe_atk"]
                nr["ally_def"] = e["new_ranks"]["foe_def"]
                nr["foe_atk"] = e["new_ranks"]["ally_atk"]
                nr["foe_def"] = e["new_ranks"]["ally_def"]
                ne["new_ranks"] = nr
            new_events.append(ne)
        new_state["events"] = new_events

        return {"type": "accepted", "state": new_state}

    def change_ability(self, player_id: str, new_ability_id: str):
        """プレイヤーの特性を変更する"""
        player = self.player1 if player_id == self.player1.id else self.player2
        
        if player.ability_change_count <= 0:
            return {"type": "error", "message": "特性はもう変更できません"}

        if new_ability_id not in self.abilities:
            return {"type": "error", "message": "存在しない特性です"}

        if new_ability_id == player.ability:
            return {"type": "error", "message": "現在の特性と同じです"}

        player.ability_change_count -= 1
        player.ability = new_ability_id

        ability_display_name = self.abilities[new_ability_id].name

        event = {
            "type": "ability_changed",
            "message": f"特性が「{ability_display_name}」に変わった！ (残り変更回数: {player.ability_change_count})",
            "player": "ally" if player.id == self.player1.id else "foe",
            # フロントエンドでの表示更新のために、変更後の情報をイベントに含める
            "new_ability": new_ability_id,
            "new_ability_change_count": player.ability_change_count
        }
        self.events.append(event)

        return self._make_response()

    def get_cpu_word(self):
        for i in self.sb_info.typed_dict:
            if(i[0] == self.character and i not in self.used):
                return i
        
        return ""

    def execute_cpu_turn(self):
        """
        CPUのターンを実行し、行動結果を返します。
        """
        cpu_word = self.get_cpu_word()
        if cpu_word:
            # CPUが選んだ単語で攻撃
            return self.try_attack(self.player2.id, cpu_word)
        else:
            # CPUが単語を見つけられなかった場合（降参）
            self.player1_win = True
            return self._make_response()

    def handle_disconnection(self, disconnected_player_id: str, message: str = "あいてが通信を切断しました。"):
        """
        プレイヤーの切断を処理し、勝敗を決定してレスポンスを返します。
        """
        # すでに決着がついている場合は何もしない
        if self.player1_win is not None:
            return None
        
        if disconnected_player_id == self.player1.id:
            self.player1_win = False
            dmg = self.player1.hp
            self.player1.take_damage(dmg)
            self.events.append({
                "type": "damage",
                "message": message,
                "ally_damage": dmg,
                "foe_damage": 0
            })
        elif disconnected_player_id == self.player2.id:
            self.player1_win = True
            dmg = self.player2.hp
            self.player2.take_damage(dmg)
            self.events.append({
                "type": "damage",
                "message": message,
                "ally_damage": 0,
                "foe_damage": dmg
            })
        
        if self.player1_win is not None:
            return self._make_response()
        return None

    def timeout(self):
        """
        タイムアウト処理: 現在のターンプレイヤーが即敗北
        """
        if self.player1_turn:
            dmg = self.player1.hp
            self.player1.take_damage(dmg)
            self.player1_win = False
            self.events.append({
                "type": "damage",
                "message": "時間切れ！敗北しました。",
                "ally_damage": dmg,
                "foe_damage": 0
            })
        else:
            dmg = self.player2.hp
            self.player2.take_damage(dmg)
            self.player1_win = True
            self.events.append({
                "type": "damage",
                "message": "時間切れ！勝利しました。",
                "ally_damage": 0,
                "foe_damage": dmg
            })
        
        return self._make_response()