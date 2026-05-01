import asyncio
import json
import logging
import time
from typing import Optional

try:
    from battle import SingleBattle
    from double_battle import DoubleBattle
    from constants import STOCK_LIVES
except ImportError:
    from backend.battle import SingleBattle
    from backend.double_battle import DoubleBattle
    from backend.constants import STOCK_LIVES

logger = logging.getLogger(__name__)

class WebSocketHandler:
    """
    WebSocketメッセージのルーティングとバトルフローの制御を担当するクラス
    """
    def __init__(self, room_manager, connection_manager):
        self.room_manager = room_manager
        self.connection_manager = connection_manager
        self.TIME_LIMIT = 20
        self.DOUBLE_TIME_LIMIT = 30

    async def _try_reconnect(self, websocket, player_id: str) -> bool:
        """切断猶予期間中のルームがあれば再接続を試みる"""
        for rid, room in self.room_manager.battle_rooms.items():
            if player_id in [p.id for p in getattr(room, 'players', [])] and not room.is_finished:
                self.room_manager.cancel_grace_period(rid, player_id)
                self.connection_manager.join_room(websocket, rid)
                await websocket.send_text(json.dumps(room.make_init_response(player_id)))
                await self.connection_manager.broadcast_battle_state(rid, room._make_response(), is_double=False, room_manager=self.room_manager)
                return True
                
        for rid, room in self.room_manager.double_battle_rooms.items():
            if player_id in [p.id for p in getattr(room, 'players', [])] and not room.is_finished:
                self.room_manager.cancel_grace_period(rid, player_id)
                self.connection_manager.join_room(websocket, rid)
                await websocket.send_text(json.dumps(room.make_init_response(player_id)))
                await self.connection_manager.broadcast_battle_state(rid, room._make_response(), is_double=True, room_manager=self.room_manager)
                return True
                
        return False

    async def handle_message(self, websocket, data: str):
        try:
            req = json.loads(data)
        except json.JSONDecodeError:
            await websocket.send_text(json.dumps({"type": "error", "message": "Invalid JSON"}))
            return

        if not isinstance(req, dict):
            return

        msg_type = req.get("type")
        info = req.get("info", {})
        player_id = info.get("player_id")
        
        # メッセージに含まれていない場合は、ConnectionManagerから取得を試みる
        if not player_id:
            player_id = self.connection_manager.get_player_id(websocket)

        # ハンドラメソッドの動的な呼び出し
        handler_name = f"_handle_{msg_type}"
        handler = getattr(self, handler_name, None)
        
        if handler:
            await handler(websocket, player_id, info)
        else:
            logger.warning(f"No handler for message type: {msg_type}")
            # エラーを返しておくとフロントエンドがフリーズしない
            await websocket.send_text(json.dumps({"type": "error", "message": f"Handler not found: {msg_type}"}))

    # --- 個別メッセージハンドラ ---

    async def _handle_update_user_info(self, websocket, player_id, info):
        if not player_id:
            logger.warning("update_user_info called without player_id")
            return
        name = info.get("name", "じぶん")
        ability = info.get("ability")
        self.room_manager.update_user_info(player_id, name, ability)
        self.connection_manager.register_player(websocket, player_id)
        await websocket.send_text(json.dumps({"type": "user_info_updated", "message": "ユーザー情報を更新しました"}))

    async def _handle_find_match(self, websocket, player_id, info):
        if not player_id:
            await websocket.send_text(json.dumps({"type": "error", "message": "プレイヤーIDが不明です。再接続してください。"}))
            return
            
        self.connection_manager.register_player(websocket, player_id)
        if await self._try_reconnect(websocket, player_id):
            return
            
        try:
            max_lives = max(1, min(10, int(info.get("max_lives", STOCK_LIVES))))
        except (TypeError, ValueError):
            max_lives = STOCK_LIVES
        
        self.connection_manager.register_player(websocket, player_id)

        # モードに応じた待機キューを選択
        if max_lives > 1:
            target_waiter = self.room_manager.waiting_player_stock
        else:
            target_waiter = self.room_manager.waiting_player_standard

        if target_waiter is not None:
            if target_waiter["player_id"] == player_id:
                return
            
            if len(self.room_manager.battle_rooms) + len(self.room_manager.double_battle_rooms) >= self.room_manager.MAX_ROOMS:
                await websocket.send_text(json.dumps({"type": "error", "message": "サーバーが混雑しています"}))
                return

            # 待機プレイヤーを取り出して対戦開始
            p1_data = target_waiter
            if max_lives > 1: self.room_manager.waiting_player_stock = None
            else: self.room_manager.waiting_player_standard = None
            
            p2_data = {"socket": websocket, "player_id": player_id}
            
            p1_profile = self.room_manager.user_profiles.get(p1_data["player_id"])
            p2_profile = self.room_manager.user_profiles.get(p2_data["player_id"])

            bi = SingleBattle(p1_data["player_id"], p2_data["player_id"], sb_info=self.room_manager.sb_info, p1_profile=p1_profile, p2_profile=p2_profile, p1_max_lives=max_lives, p2_max_lives=max_lives)
            bi.init_character()
            self.room_manager.battle_rooms[bi.room_id] = bi
            
            logger.info(f"Match started: room={bi.room_id}, p1={p1_data['player_id']}, p2={p2_data['player_id']}")

            self.connection_manager.join_room(p1_data["socket"], bi.room_id)
            self.connection_manager.join_room(p2_data["socket"], bi.room_id)

            await p1_data["socket"].send_text(json.dumps(bi.make_init_response(p1_data["player_id"])))
            await p2_data["socket"].send_text(json.dumps(bi.make_init_response(p2_data["player_id"])))
            
            await self._start_turn_timer(bi.room_id, is_double=False)
        else:
            new_waiter = {"socket": websocket, "player_id": player_id}
            if max_lives > 1: self.room_manager.waiting_player_stock = new_waiter
            else: self.room_manager.waiting_player_standard = new_waiter
            await websocket.send_text(json.dumps({"type": "waiting", "message": "マッチング中…"}))

    async def _handle_find_match_double(self, websocket, player_id, info):
        if not player_id:
            await websocket.send_text(json.dumps({"type": "error", "message": "プレイヤーIDが不明です。再接続してください。"}))
            return
        self.connection_manager.register_player(websocket, player_id)
        if await self._try_reconnect(websocket, player_id):
            return
        
        if self.room_manager.waiting_player_double is not None:
            p1_data = self.room_manager.waiting_player_double
            if p1_data["player_id"] == player_id: return
            self.room_manager.waiting_player_double = None
            
            p2_data = {"socket": websocket, "player_id": player_id}
            
            bi = DoubleBattle("1v1_double", [p1_data["player_id"]], [p2_data["player_id"]], sb_info=self.room_manager.sb_info, profiles=self.room_manager.user_profiles)
            bi.init_character()
            self.room_manager.double_battle_rooms[bi.room_id] = bi
            
            self.connection_manager.join_room(p1_data["socket"], bi.room_id)
            self.connection_manager.join_room(p2_data["socket"], bi.room_id)

            await p1_data["socket"].send_text(json.dumps(bi.make_init_response(p1_data["player_id"])))
            await p2_data["socket"].send_text(json.dumps(bi.make_init_response(p2_data["player_id"])))
            await self._start_turn_timer(bi.room_id, is_double=True)
        else:
            self.room_manager.waiting_player_double = {"socket": websocket, "player_id": player_id}
            await websocket.send_text(json.dumps({"type": "waiting", "message": "マッチング中…"}))

    async def _handle_create_private_room(self, websocket, player_id, info):
        # シングルバトルのプライベートルーム作成
        p1_max_lives = max(1, min(10, int(info.get("p1_max_lives", STOCK_LIVES))))
        p2_max_lives = max(1, min(10, int(info.get("p2_max_lives", STOCK_LIVES))))
        new_id = self.room_manager.create_private_room(websocket, player_id, p1_max_lives, p2_max_lives, is_double=False)
        await websocket.send_text(json.dumps({"type": "private_room_created", "room_id": new_id}))

    async def _handle_create_double_room(self, websocket, player_id, info):
        # ダブルバトル用のプライベートルーム作成
        new_id = self.room_manager.create_private_room(websocket, player_id, 1, 1, is_double=True)
        await websocket.send_text(json.dumps({"type": "private_room_created", "room_id": new_id}))

    async def _handle_join_double_room(self, websocket, player_id, info):
        # 既存のダブルバトルプライベートルームに参加
        await self._handle_join_private_room(websocket, player_id, info, is_double=True)

    async def _handle_make_new_battle(self, websocket, player_id, info):
        if not player_id:
            await websocket.send_text(json.dumps({"type": "error", "message": "プレイヤーIDが不明です。再接続してください。"}))
            return
        self.connection_manager.register_player(websocket, player_id)
        if await self._try_reconnect(websocket, player_id):
            return
            
        # シングルCPU戦などの開始
        p2_id = info.get("player2_id", "cpu_1")
        try:
            max_lives = max(1, min(10, int(info.get("max_lives", STOCK_LIVES))))
        except (TypeError, ValueError):
            max_lives = STOCK_LIVES
        
        p1_profile = self.room_manager.user_profiles.get(player_id)
        # CPUの場合はプロファイルを適当に作るか、Noneにする
        p2_profile = {"name": "CPU", "ability": "random"} if p2_id.startswith("cpu") else None
        
        bi = SingleBattle(player_id, p2_id, sb_info=self.room_manager.sb_info, p1_profile=p1_profile, p2_profile=p2_profile, p1_max_lives=max_lives, p2_max_lives=max_lives, is_cpu=p2_id.startswith("cpu"))
        bi.init_character()
        self.room_manager.battle_rooms[bi.room_id] = bi
        
        self.connection_manager.register_player(websocket, player_id)
        self.connection_manager.join_room(websocket, bi.room_id)
        
        await websocket.send_text(json.dumps(bi.make_init_response(player_id)))
        await self._after_turn_action(bi.room_id, bi, is_double=False)

    async def _handle_join_double_cpu_room(self, websocket, player_id, info):
        if not player_id:
            await websocket.send_text(json.dumps({"type": "error", "message": "プレイヤーIDが不明です。再接続してください。"}))
            return
        # ダブルCPU戦の開始
        bi = DoubleBattle(
            "1v1_double", 
            [player_id], 
            ["cpu_a", "cpu_b"], 
            sb_info=self.room_manager.sb_info, 
            profiles=self.room_manager.user_profiles,
            is_cpu=True
        )
        bi.init_character()
        
        self.room_manager.double_battle_rooms[bi.room_id] = bi
        self.connection_manager.register_player(websocket, player_id)
        self.connection_manager.join_room(websocket, bi.room_id)
        
        await websocket.send_text(json.dumps(bi.make_init_response(player_id)))
        await self._after_turn_action(bi.room_id, bi, is_double=True)

    async def _handle_join_private_room(self, websocket, player_id, info, is_double=False):
        room_id = info.get("room_id")
        self.connection_manager.register_player(websocket, player_id)

        target_private_rooms = self.room_manager.double_private_rooms if is_double else self.room_manager.private_rooms

        if room_id: # 既存のルームに参加
            if room_id in target_private_rooms:
                if len(self.room_manager.battle_rooms) + len(self.room_manager.double_battle_rooms) >= self.room_manager.MAX_ROOMS:
                    await websocket.send_text(json.dumps({"type": "error", "message": "サーバーが混雑しています"}))
                    return

                p1_data = target_private_rooms.pop(room_id)
                if p1_data["player_id"] == player_id:
                    return

                p2_data = {"socket": websocket, "player_id": player_id}
                p1_profile = self.room_manager.user_profiles.get(p1_data["player_id"])
                p2_profile = self.room_manager.user_profiles.get(p2_data["player_id"])

                if is_double:
                    bi = DoubleBattle_info(
                        "1v1_double", [p1_data["player_id"]], [p2_data["player_id"]],
                        sb_info=self.room_manager.sb_info, room_id=room_id,
                        profiles=self.room_manager.user_profiles,
                        is_cpu=False
                    )
                    bi.init_character()
                    self.room_manager.double_battle_rooms[bi.room_id] = bi
                else:
                    bi = SingleBattle(
                        p1_data["player_id"], p2_data["player_id"], 
                        sb_info=self.room_manager.sb_info, room_id=room_id, 
                        p1_profile=p1_profile, p2_profile=p2_profile, 
                        p1_max_lives=p1_data.get("p1_max_lives", STOCK_LIVES),
                        p2_max_lives=p1_data.get("p2_max_lives", STOCK_LIVES)
                    )
                    bi.init_character()
                    self.room_manager.battle_rooms[bi.room_id] = bi
                
                self.connection_manager.join_room(p1_data["socket"], bi.room_id)
                self.connection_manager.join_room(p2_data["socket"], bi.room_id)

                await p1_data["socket"].send_text(json.dumps(bi.make_init_response(p1_data["player_id"])))
                await p2_data["socket"].send_text(json.dumps(bi.make_init_response(p2_data["player_id"])))
                await self._start_turn_timer(bi.room_id, is_double=is_double)
            else:
                await websocket.send_text(json.dumps({"type": "error", "message": "ルームが見つかりません"}))
        else: # 新規作成
            p1_max_lives = max(1, min(10, int(info.get("p1_max_lives", STOCK_LIVES))))
            p2_max_lives = max(1, min(10, int(info.get("p2_max_lives", STOCK_LIVES))))
            new_id = self.room_manager.create_private_room(websocket, player_id, p1_max_lives, p2_max_lives, is_double=is_double)
            await websocket.send_text(json.dumps({"type": "private_room_created", "room_id": new_id}))

    async def _handle_submit_word(self, websocket, player_id, info):
        room_id = info.get("room_id")
        word = info.get("word")
        if not room_id or not word: return

        room = self.room_manager.get_room(room_id)
        if not room:
            await websocket.send_text(json.dumps({"type": "error", "message": "ルームが見つかりません"}))
            return

        res = room.try_attack(player_id, word)
        if res.get("type") == "error":
            await websocket.send_text(json.dumps(res))
            return

        is_double = hasattr(room, "team1_win")
        await self.connection_manager.broadcast_battle_state(room_id, res, is_double=is_double, room_manager=self.room_manager)

        # ターン終了後の処理 (タイマー、CPU戦など)
        await self._after_turn_action(room_id, room, is_double)

    async def _handle_submit_word_double(self, websocket, player_id, info):
        # 内部的には submit_word と同じロジックで対応可能
        await self._handle_submit_word(websocket, player_id, info)

    async def _handle_change_ability(self, websocket, player_id, info):
        room_id = info.get("room_id")
        ability_id = info.get("ability_id")
        char_id = info.get("char_id", "p1") # ダブルバトルの場合は指定が必要

        room = self.room_manager.get_room(room_id)
        if not room: return

        # 特性変更の実行
        is_double_battle = hasattr(room, "team1_win")
        if is_double_battle:
            # ダブルバトルの場合
            res = room.change_ability(player_id, char_id, ability_id)
        else:
            # シングルバトルの場合
            res = room.change_ability(player_id, ability_id)

        if res.get("type") == "error":
            await websocket.send_text(json.dumps(res))
        else:
            is_double = hasattr(room, "team1_win")
            await self.connection_manager.broadcast_battle_state(room_id, res, is_double=is_double, room_manager=self.room_manager)

    async def _handle_change_ability_double(self, websocket, player_id, info):
        await self._handle_change_ability(websocket, player_id, info)

    async def _handle_include_check(self, websocket, player_id, info):
        room_id = info.get("room_id")
        word = info.get("word")
        room = self.room_manager.get_room(room_id)
        if room and hasattr(room, "include_check"):
            res = room.include_check(word)
            await websocket.send_text(json.dumps(res))

    async def _handle_include_check_double(self, websocket, player_id, info):
        await self._handle_include_check(websocket, player_id, info)

    async def _handle_run_away(self, websocket, player_id, info):
        room_id = info.get("room_id")
        room = self.room_manager.get_room(room_id)
        if room:
            res = room.handle_disconnection(player_id)
            if res:
                is_double = hasattr(room, "team1_win")
                await self.connection_manager.broadcast_battle_state(room_id, res, is_double=is_double, room_manager=self.room_manager)

    async def _handle_run_away_double(self, websocket, player_id, info):
        await self._handle_run_away(websocket, player_id, info)

    # --- ターン終了後の共通アクション ---

    async def _after_turn_action(self, room_id, room, is_double):
        # 決着がついた場合
        if room.is_finished:
            self.room_manager.cancel_timer(room_id)
            self.room_manager.schedule_room_cleanup(room_id, delay=10)
            return

        # CPU戦の処理
        if room.is_cpu:
            # CPUのターンかどうか判定
            is_cpu_turn = False
            if not is_double:
                is_cpu_turn = not room.player1_turn
            else:
                is_cpu_turn = room.get_current_actor().owner_id.startswith("cpu_")

            if is_cpu_turn:
                await asyncio.sleep(1)
                cpu_res = room.execute_cpu_turn()
                await self.connection_manager.broadcast_battle_state(room_id, cpu_res, is_double=is_double, room_manager=self.room_manager)
                if room.is_finished:
                    return

        # タイマー開始
        await self._start_turn_timer(room_id, is_double)

    async def _start_turn_timer(self, room_id, is_double):
        room = self.room_manager.get_room(room_id)
        if not room or room.is_cpu: return

        limit = self.DOUBLE_TIME_LIMIT if is_double else self.TIME_LIMIT
        
        # 既存のタイマーをキャンセルして新しく作成
        task = asyncio.create_task(self._timeout_handler(room_id, is_double, limit))
        self.room_manager.set_timer(room_id, task)

    async def _timeout_handler(self, room_id, is_double, limit):
        try:
            await asyncio.sleep(limit)
            room = self.room_manager.get_room(room_id)
            if not room: return

            res = room.timeout()
            await self.connection_manager.broadcast_battle_state(room_id, res, is_double=is_double, room_manager=self.room_manager)
            
            await self._after_turn_action(room_id, room, is_double)
        except asyncio.CancelledError:
            pass
