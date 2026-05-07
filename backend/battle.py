import random
try:
    from base_battle import BaseBattle
    from player import Player
    from SB_info import SB_info
    from abilities import get_default_abilities
    from constants import MAX_HP, STOCK_LIVES, ABILITY_CHANGE_COUNT_INIT
    from schemas import BattleResponse, BattleState, CharacterState, BattleEvent
except ImportError:
    from backend.base_battle import BaseBattle
    from backend.player import Player
    from backend.SB_info import SB_info
    from backend.abilities import get_default_abilities
    from backend.constants import MAX_HP, STOCK_LIVES, ABILITY_CHANGE_COUNT_INIT

# 定数は constants.py に集約されています


class SingleBattle(BaseBattle):
    def __init__(self, player1_id: str, player2_id: str, sb_info: SB_info, room_id: str | None = None, p1_profile: dict = None, p2_profile: dict = None, p1_max_lives: int = STOCK_LIVES, p2_max_lives: int = STOCK_LIVES, is_cpu: bool = False):
        super().__init__(sb_info, room_id)
        p1_name = p1_profile.get("name", "じぶん") if p1_profile else "じぶん"
        p2_name = p2_profile.get("name", "プレイヤー2") if p2_profile else "プレイヤー2"
        
        self.player1 = Player(player1_id, p1_name, lives=p1_max_lives, max_lives=p1_max_lives)
        self.player2 = Player(player2_id, p2_name, lives=p2_max_lives, max_lives=p2_max_lives)
        self.players = [self.player1, self.player2]
        
        # 行動順の設定
        self.turn_order = [self.player1, self.player2]
        if random.random() < 0.5:
            self.turn_order = [self.player2, self.player1]
        self.current_turn_index = 0
        self.is_cpu_battle = is_cpu
        self.abilities = get_default_abilities()
        self.init_character()
        
        # プロファイルから特性を反映 (randomや存在しないIDの場合はランダムに割り当て)
        def resolve_ability(profile):
            if profile and profile.get("ability") in self.abilities:
                return profile["ability"]
            # ランダムまたは無効な特性IDの場合
            valid_ids = [k for k in self.abilities.keys() if k != "random"]
            return random.choice(valid_ids) if valid_ids else "ikaku"

        self.player1.ability = resolve_ability(p1_profile)
        self.player2.ability = resolve_ability(p2_profile)
        
        self.player1.types = []
        self.player2.types = []
        
        self.events = [{"type": "message", "message": "マッチングした！"}]


    @property
    def is_double(self) -> bool:
        return False

    @property
    def time_limit(self) -> int:
        return 20


    @property
    def is_cpu_turn(self) -> bool:
        actor = self.get_current_actor()
        return self.is_cpu and actor.id == self.player2.id


    def get_team_index(self, player_id: str) -> int:
        return 0 if player_id == self.player1.id else 1

    def get_enemies(self, player) -> list[Player]:
        return [self.player2] if player.id == self.player1.id else [self.player1]

    def format_predictions(self, enemies: list[Player], at1: str, at2: str) -> dict:
        enemy = enemies[0]
        dt1 = enemy.types[0] if len(enemy.types) >= 1 else ""
        dt2 = enemy.types[1] if len(enemy.types) >= 2 else ""
        effect = self.sb_info.type_effect(at1, at2, dt1, dt2)
        return {"prediction": self._get_effect_message(effect)}

    def init_character(self):
        self.character = random.choice(self.START_CHARACTERS)

    def _get_winner_team(self) -> int | None:
        """どのチームが勝ったかを返す"""
        if self.player1.is_defeated:
            return 1 # P2の勝ち
        if self.player2.is_defeated:
            return 0 # P1の勝ち
        return None





    def _get_attack_target(self, attacker: Player, target_id: str = None) -> Player:
        """SingleBattleでは常に相手プレイヤーを狙う"""
        return self.player2 if attacker.id == self.player1.id else self.player1

    def _make_response(self) -> dict:
        # 共通メソッドを呼び出し (SingleBattle特有のフィールドを渡す)
        return self._create_base_response([self.player1, self.player2])

    def get_personalized_response(self, base_res: dict, player_id: str, time_limit: int = None) -> dict:
        import copy
        new_res = copy.deepcopy(base_res)
        state = new_res["state"]
        
        # IDを文字列として確実に比較
        pid_str = str(player_id)
        is_p1 = (pid_str == str(self.player1.id))
        is_p2 = (pid_str == str(self.player2.id))
        
        # 自分のターンかどうかを判定
        state["is_my_turn"] = (str(state["current_owner_id"]) == pid_str)
        
        # ライフ情報の視点を調整
        # ライフ情報の視点を調整 (CharacterState内のmax_livesを使用するようになったが、トップレベルの互換性も維持)
        if is_p1:
            state["ally_max_lives"] = self.player1.max_lives
            state["foe_max_lives"] = self.player2.max_lives
        elif is_p2:
            state["ally_max_lives"] = self.player2.max_lives
            state["foe_max_lives"] = self.player1.max_lives
        
        # イベントの個別化 (常に実行)
        self._personalize_events(new_res.get("events", []), pid_str)

        if self.winner_team is not None:
            state["ally_win"] = self.is_player_winner(pid_str)
        
        # 敵の特性をマスク
        for k, char_info in state["characters"].items():
            if char_info["owner_id"] != pid_str:
                char_info["owner_id"] = "opponent"
                char_info["ability"] = "secret"
                char_info["ability_change_count"] = ABILITY_CHANGE_COUNT_INIT

        # イベントのマスク
        masked_events = []
        for e in new_res["events"]:
            if e.get("type") == "ability_changed":
                cid = e.get("target")
                if cid in state["characters"] and state["characters"][cid]["owner_id"] == "opponent":
                    continue
            masked_events.append(e)
        new_res["events"] = masked_events

        # フロントエンド演出用のマッピング情報
        id_to_ui_map = {}
        player_ids = []
        if is_p1:
            id_to_ui_map = {str(self.player1.id): "ally", str(self.player2.id): "foe"}
            player_ids = [str(self.player1.id)]
        elif is_p2:
            id_to_ui_map = {str(self.player2.id): "ally", str(self.player1.id): "foe"}
            player_ids = [str(self.player2.id)]
        else:
            # 観戦者などの場合 (デフォルトでP1視点)
            id_to_ui_map = {str(self.player1.id): "ally", str(self.player2.id): "foe"}
            player_ids = [str(self.player1.id)]

        new_res["info"] = {
            "player_ids": player_ids,
            "id_to_ui_map": id_to_ui_map,
            "time_limit": time_limit,
            "total_time": time_limit
        }
        
        return new_res



    def _select_cpu_target(self, actor: Player) -> str | None:
        """SingleBattleでは常に相手プレイヤー(P1)を狙う"""
        return self.player1.id


