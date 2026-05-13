import asyncio
import json
import logging
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

    async def _safe_send(self, websocket, data: dict):
        """例外を捕捉して安全にメッセージを送信する"""
        await self.connection_manager.safe_send_text(websocket, json.dumps(data))


    async def handle_message(self, websocket, data: str):
        try:
            req = json.loads(data)
        except json.JSONDecodeError:
            await self._safe_send(websocket, {"type": "error", "message": "Invalid JSON"})
            return

        msg_type = req.get("type")
        if msg_type == "ping":
            await self._safe_send(websocket, {"type": "pong"})
            return

        info = req.get("info", {})
        player_id = info.get("player_id")
        
        # メッセージにIDが含まれていれば登録を更新、なければ既存の登録から取得
        if player_id:
            self.connection_manager.register_player(websocket, player_id)
        else:
            player_id = self.connection_manager.get_player_id(websocket)

        handler_name = f"_handle_{msg_type}"
        handler = getattr(self, handler_name, None)
        
        if handler:
            try:
                await handler(websocket, player_id, info)
            except Exception as e:
                logger.error(f"Error handling message {msg_type}: {e}", exc_info=True)
                await self._safe_send(websocket, {"type": "error", "message": f"Internal server error: {str(e)}"})
        else:
            logger.warning(f"No handler for message type: {msg_type}")
            await self._safe_send(websocket, {"type": "error", "message": f"Handler not found: {msg_type}"})

    async def _handle_pre_check(self, websocket, player_id, info):
        """入力中の単語チェックと相性予測 (旧 pre_check)"""
        await self._handle_include_check(websocket, player_id, info)

    async def _handle_update_user_info(self, websocket, player_id, info):
        if not player_id:
            logger.warning("update_user_info called without player_id")
            return
        name = info.get("name", "じぶん")
        ability = info.get("ability")
        ability_2 = info.get("ability_2")
        self.room_manager.update_user_info(player_id, name, ability, ability_2)
        self.connection_manager.register_player(websocket, player_id)
        await self._safe_send(websocket, {"type": "user_info_updated", "message": "ユーザー情報を更新しました"})

    async def _handle_find_match(self, websocket, player_id, info):
        if not player_id:
            await self._safe_send(websocket, {"type": "error", "message": "プレイヤーIDが不明です。再接続してください。"})
            return
            
        if len(self.room_manager.rooms) >= self.room_manager.MAX_ROOMS:
            await self._safe_send(websocket, {"type": "error", "message": "サーバーが混雑しています。しばらく待ってからお試しください。"})
            return

        self.connection_manager.register_player(websocket, player_id)
        
        try:
            max_lives = max(1, min(10, int(info.get("max_lives", STOCK_LIVES))))
        except (TypeError, ValueError):
            max_lives = STOCK_LIVES
        
        # モード判定
        is_double = "double" in info.get("type", "") 
        name = info.get("name", "じぶん")
        ability = info.get("ability", "なし")
        mode_str = "ダブル" if is_double else "特殊ルール" if max_lives > 1 else "シングル"
        logger.info(f"[MATCH] {name} (特性: {ability} / {max_lives}機 / {mode_str}) がマッチング開始")

        self.connection_manager.register_player(websocket, player_id)

        if max_lives > 1:
            target_waiter = self.room_manager.waiting_player_stock
        else:
            target_waiter = self.room_manager.waiting_player_standard

        if target_waiter is not None:
            if target_waiter["player_id"] == player_id:
                return
            
            ability = info.get("ability")
            ability_2 = info.get("ability_2")
            self.room_manager.update_user_info(player_id, name, ability, ability_2)

            p1_data = target_waiter
            p2_data = {"socket": websocket, "player_id": player_id}
            
            # 待機者のソケットが生きているか確認
            from starlette.websockets import WebSocketState
            if p1_data["socket"].client_state != WebSocketState.CONNECTED:
                # 待機者が切断していた場合、今回のプレイヤーを待機者に設定
                new_waiter = {"socket": websocket, "player_id": player_id}
                if max_lives > 1: self.room_manager.waiting_player_stock = new_waiter
                else: self.room_manager.waiting_player_standard = new_waiter
                await self._safe_send(websocket, {"type": "waiting", "message": "マッチング中..."})
                return

            if max_lives > 1: self.room_manager.waiting_player_stock = None
            else: self.room_manager.waiting_player_standard = None
            
            p1_profile = self.room_manager.user_profiles.get(p1_data["player_id"])
            p2_profile = self.room_manager.user_profiles.get(p2_data["player_id"])

            bi = SingleBattle(p1_data["player_id"], p2_data["player_id"], sb_info=self.room_manager.sb_info, p1_profile=p1_profile, p2_profile=p2_profile, p1_max_lives=max_lives, p2_max_lives=max_lives)
            bi.init_character()
            self.room_manager.rooms[bi.room_id] = bi
            
            self.connection_manager.join_room(p1_data["socket"], bi.room_id)
            self.connection_manager.join_room(p2_data["socket"], bi.room_id)

            bi.events.append({"type": "message", "message": "マッチングした！"})
            p1_name = p1_profile.get('name', '???')
            logger.info(f"[MATCH] {name} VS {p1_name} ({mode_str}) 対戦開始！")

            await self._safe_send(p1_data["socket"], bi.make_init_response(p1_data["player_id"]))
            await self._safe_send(p2_data["socket"], bi.make_init_response(p2_data["player_id"]))
            
            await self._after_turn_action(bi.room_id, bi)
        else:
            new_waiter = {"socket": websocket, "player_id": player_id}
            if max_lives > 1: self.room_manager.waiting_player_stock = new_waiter
            else: self.room_manager.waiting_player_standard = new_waiter
            await self._safe_send(websocket, {"type": "waiting", "message": "マッチング中..."})

    async def _handle_find_match_double(self, websocket, player_id, info):
        if not player_id:
            await self._safe_send(websocket, {"type": "error", "message": "プレイヤーIDが不明です。再接続してください。"})
            return
            
        if len(self.room_manager.rooms) >= self.room_manager.MAX_ROOMS:
            await self._safe_send(websocket, {"type": "error", "message": "サーバーが混雑しています"})
            return
        self.connection_manager.register_player(websocket, player_id)
        name = info.get("name", "じぶん")
        ability = info.get("ability")
        ability_2 = info.get("ability_2")
        self.room_manager.update_user_info(player_id, name, ability, ability_2)

        if self.room_manager.waiting_player_double is not None:
            p1_data = self.room_manager.waiting_player_double
            if p1_data["player_id"] == player_id: return
            
            # 待機者のソケットが生きているか確認
            from starlette.websockets import WebSocketState
            if p1_data["socket"].client_state != WebSocketState.CONNECTED:
                self.room_manager.waiting_player_double = {"socket": websocket, "player_id": player_id}
                await self._safe_send(websocket, {"type": "waiting", "message": "マッチング中..."})
                return

            self.room_manager.waiting_player_double = None
            p2_data = {"socket": websocket, "player_id": player_id}
            
            bi = DoubleBattle("1v1_double", [p1_data["player_id"]], [p2_data["player_id"]], sb_info=self.room_manager.sb_info, profiles=self.room_manager.user_profiles)
            bi.init_character()
            self.room_manager.rooms[bi.room_id] = bi
            
            self.connection_manager.join_room(p1_data["socket"], bi.room_id)
            self.connection_manager.join_room(p2_data["socket"], bi.room_id)
            
            bi.events.append({"type": "message", "message": "マッチングした！"})

            await self._safe_send(p1_data["socket"], bi.make_init_response(p1_data["player_id"]))
            await self._safe_send(p2_data["socket"], bi.make_init_response(p2_data["player_id"]))
            
            await self._after_turn_action(bi.room_id, bi)
        else:
            self.room_manager.waiting_player_double = {"socket": websocket, "player_id": player_id}
            await self._safe_send(websocket, {"type": "waiting", "message": "マッチング中..."})

    async def _handle_create_private_room(self, websocket, player_id, info):
        name = info.get("name", "じぶん")
        self.room_manager.update_user_info(player_id, name, info.get("ability"), info.get("ability_2"))
        p1_max_lives = max(1, min(10, int(info.get("p1_max_lives", STOCK_LIVES))))
        p2_max_lives = max(1, min(10, int(info.get("p2_max_lives", STOCK_LIVES))))
        if len(self.room_manager.rooms) >= self.room_manager.MAX_ROOMS:
            await self._safe_send(websocket, {"type": "error", "message": "サーバーが混雑しています"})
            return
        new_id = self.room_manager.create_private_room(websocket, player_id, p1_max_lives, p2_max_lives, is_double=False)
        
        mode_str = "特殊ルール" if p1_max_lives > 1 else "シングル"
        logger.info(f"[ROOM] {name} が合言葉ルーム [{new_id}] を作成 ({mode_str})")
        await self._safe_send(websocket, {"type": "private_room_created", "room_id": new_id})

    async def _handle_create_double_room(self, websocket, player_id, info):
        name = info.get("name", "じぶん")
        new_id = self.room_manager.create_private_room(websocket, player_id, 1, 1, is_double=True)
        logger.info(f"[ROOM] {name} が合言葉ルーム [{new_id}] を作成 (ダブル)")
        await self._safe_send(websocket, {"type": "private_room_created", "room_id": new_id})

    async def _handle_join_double_room(self, websocket, player_id, info):
        await self._handle_join_private_room(websocket, player_id, info, is_double=True)

    async def _handle_join_cpu_room(self, websocket, player_id, info):
        await self._handle_make_new_battle(websocket, player_id, info)

    async def _handle_make_new_battle(self, websocket, player_id, info):
        if not player_id:
            await self._safe_send(websocket, {"type": "error", "message": "プレイヤーIDが不明です。再接続してください。"})
            return
        
        if len(self.room_manager.rooms) >= self.room_manager.MAX_ROOMS:
            await self._safe_send(websocket, {"type": "error", "message": "サーバーが混雑しています"})
            return
        self.connection_manager.register_player(websocket, player_id)
        
        name = info.get("name", "じぶん")
        ability = info.get("ability")
        ability_2 = info.get("ability_2")
        self.room_manager.update_user_info(player_id, name, ability, ability_2)

        p2_id = info.get("player2_id", "cpu_1")
        try:
            max_lives = max(1, min(10, int(info.get("max_lives", STOCK_LIVES))))
        except (TypeError, ValueError):
            max_lives = STOCK_LIVES
        
        p1_profile = self.room_manager.user_profiles.get(player_id)
        p2_profile = {"name": "CPU", "ability": "random"} if p2_id.startswith("cpu") else None
        
        try:
            bi = SingleBattle(
                player1_id=player_id, 
                player2_id=p2_id, 
                sb_info=self.room_manager.sb_info, 
                p1_profile=p1_profile, 
                p2_profile=p2_profile, 
                p1_max_lives=max_lives, 
                p2_max_lives=max_lives, 
                is_cpu=p2_id.startswith("cpu")
            )
            bi.init_character()
            self.room_manager.rooms[bi.room_id] = bi
            
            self.connection_manager.register_player(websocket, player_id)
            self.connection_manager.join_room(websocket, bi.room_id)
            
            bi.events.append({"type": "message", "message": "マッチングした！"})
            
            init_res = bi.make_init_response(player_id)
            await self._safe_send(websocket, init_res)
            
            await self._after_turn_action(bi.room_id, bi)
        except Exception as e:
            logger.error(f"Error in _handle_make_new_battle: {e}", exc_info=True)
            await self._safe_send(websocket, {"type": "error", "message": f"ルーム作成エラー: {str(e)}"})

    async def _handle_join_double_cpu_room(self, websocket, player_id, info):
        if not player_id:
            await self._safe_send(websocket, {"type": "error", "message": "プレイヤーIDが不明です。再接続してください。"})
            return
        self.connection_manager.register_player(websocket, player_id)
        
        name = info.get("name", "じぶん")
        ability = info.get("ability")
        ability_2 = info.get("ability_2")
        self.room_manager.update_user_info(player_id, name, ability, ability_2)

        bi = DoubleBattle(
            "1v1_double", 
            [player_id], 
            ["cpu_a", "cpu_b"], 
            sb_info=self.room_manager.sb_info, 
            profiles=self.room_manager.user_profiles,
            is_cpu=True
        )
        bi.init_character()
        
        self.room_manager.rooms[bi.room_id] = bi
        self.connection_manager.register_player(websocket, player_id)
        self.connection_manager.join_room(websocket, bi.room_id)
        
        await self._safe_send(websocket, bi.make_init_response(player_id))
        await self._after_turn_action(bi.room_id, bi)

    async def _handle_join_private_room(self, websocket, player_id, info, is_double=False):
        room_id = info.get("room_id")
        self.room_manager.update_user_info(player_id, info.get("name", "じぶん"), info.get("ability"), info.get("ability_2"))
        self.connection_manager.register_player(websocket, player_id)

        target_data = self.room_manager.private_waiting_rooms.get(room_id)

        if room_id:
            if target_data:
                if len(self.room_manager.rooms) >= self.room_manager.MAX_ROOMS:
                    await self._safe_send(websocket, {"type": "error", "message": "サーバーが混雑しています"})
                    return

                self.room_manager.private_waiting_rooms.pop(room_id)
                if target_data["player_id"] == player_id:
                    return

                p1_data = target_data
                p2_data = {"socket": websocket, "player_id": player_id}
                
                if p1_data.get("is_double"):
                    bi = DoubleBattle(room_id, [p1_data["player_id"]], [player_id], sb_info=self.room_manager.sb_info, profiles=self.room_manager.user_profiles)
                else:
                    p1_profile = self.room_manager.user_profiles.get(p1_data["player_id"])
                    p2_profile = self.room_manager.user_profiles.get(player_id)
                    bi = SingleBattle(p1_data["player_id"], player_id, sb_info=self.room_manager.sb_info, room_id=room_id, p1_profile=p1_profile, p2_profile=p2_profile, p1_max_lives=p1_data["p1_max_lives"], p2_max_lives=p1_data["p2_max_lives"])
                
                bi.init_character()
                self.room_manager.rooms[bi.room_id] = bi
                
                self.connection_manager.join_room(p1_data["socket"], bi.room_id)
                self.connection_manager.join_room(p2_data["socket"], bi.room_id)

                bi.events.append({"type": "message", "message": "マッチングした！"})

                limit = bi.time_limit
                await self._safe_send(p1_data["socket"], bi.make_init_response(p1_data["player_id"], time_limit=limit))
                await self._safe_send(p2_data["socket"], bi.make_init_response(p2_data["player_id"], time_limit=limit))
                
                await self._after_turn_action(bi.room_id, bi)
            else:
                await self._safe_send(websocket, {"type": "error", "message": "ルームが見つかりません"})
        else:
            p1_max_lives = max(1, min(10, int(info.get("p1_max_lives", STOCK_LIVES))))
            p2_max_lives = max(1, min(10, int(info.get("p2_max_lives", STOCK_LIVES))))
            new_id = self.room_manager.create_private_room(websocket, player_id, p1_max_lives, p2_max_lives, is_double=is_double)
            await self._safe_send(websocket, {"type": "private_room_created", "room_id": new_id})

    async def _handle_submit_word(self, websocket, player_id, info):
        room_id = info.get("room_id")
        word = info.get("word")
        if not room_id or not word: return

        room = self.room_manager.get_room(room_id)
        if not room:
            await self._safe_send(websocket, {"type": "error", "message": "ルームが見つかりません"})
            return

        profile = self.room_manager.user_profiles.get(player_id, {})
        name = profile.get("name", "じぶん")
        
        # 現在の状態（HPや残機）を抽出
        char_info = ""
        if hasattr(room, 'characters') and player_id in room.characters:
            c = room.characters[player_id]
            hp = getattr(c, 'hp', 0)
            lives = getattr(c, 'lives', 1)
            char_info = f" [HP:{hp} / 残機:{lives}]"
        
        mode_str = "ダブル" if room.is_double else "特殊" if getattr(room, 'p1_max_lives', 1) > 1 else "シングル"
        logger.info(f"[WORD] {name}: {word}{char_info} ({mode_str})")

        target_id = info.get("target_id")
        res = room.try_attack(player_id, word, target_id)
        if res.get("type") == "error":
            await self._safe_send(websocket, res)
            return

        is_double = room.is_double
        limit = room.time_limit
        await self.connection_manager.broadcast_battle_state(room_id, res, is_double=is_double, room_manager=self.room_manager, time_limit=limit)

        await self._after_turn_action(room_id, room)

    _handle_submit_word_double = _handle_submit_word

    async def _handle_change_ability(self, websocket, player_id, info):
        room_id = info.get("room_id")
        ability_id = info.get("ability_id")
        char_id = info.get("char_id") # None if single

        room = self.room_manager.get_room(room_id)
        if not room: return

        profile = self.room_manager.user_profiles.get(player_id, {})
        name = profile.get("name", "じぶん")
        mode_str = "ダブル" if room.is_double else "特殊" if getattr(room, 'p1_max_lives', 1) > 1 else "シングル"
        logger.info(f"[ABILITY] {name}: {ability_id} ({mode_str})")

        res = room.change_ability(player_id, ability_id, char_id=char_id)

        if res.get("type") == "error":
            await self._safe_send(websocket, res)
        else:
            await self.connection_manager.broadcast_battle_state(room_id, res, is_double=room.is_double, room_manager=self.room_manager, time_limit=room.time_limit)

    _handle_change_ability_double = _handle_change_ability

    async def _handle_include_check(self, websocket, player_id, info):
        room_id = info.get("room_id")
        word = info.get("word")
        room = self.room_manager.get_room(room_id)
        if room:
            res = room.include_check(word)
            await self._safe_send(websocket, res)

    _handle_include_check_double = _handle_include_check

    async def _handle_run_away(self, websocket, player_id, info):
        room_id = info.get("room_id")
        room = self.room_manager.get_room(room_id)
        if room:
            profile = self.room_manager.user_profiles.get(player_id, {})
            name = profile.get("name", "じぶん")
            logger.info(f"[RUN_AWAY] {name} が降参しました")
            
            res = room.handle_disconnection(player_id)
            if res:
                await self.connection_manager.broadcast_battle_state(room_id, res, is_double=room.is_double, room_manager=self.room_manager, time_limit=room.time_limit)
                await self._after_turn_action(room_id, room)

    _handle_run_away_double = _handle_run_away

    async def _after_turn_action(self, room_id, room):
        if room.is_finished:
            self.room_manager.cancel_timer(room_id)
            self.room_manager.schedule_room_cleanup(room_id, delay=10)
            return

        if room.is_cpu_turn:
            await asyncio.sleep(1)
            cpu_res = room.execute_cpu_turn()
            if cpu_res:
                await self.connection_manager.broadcast_battle_state(room_id, cpu_res, is_double=room.is_double, room_manager=self.room_manager, time_limit=room.time_limit)
                if room.is_finished:
                    await self._after_turn_action(room_id, room)
                    return

        await self._start_turn_timer(room_id, room)

    async def _start_turn_timer(self, room_id, room):
        if not room or room.is_cpu: return
        
        task = asyncio.create_task(self._timeout_handler(room_id, room))
        self.room_manager.set_timer(room_id, task)

    async def _timeout_handler(self, room_id, room):
        try:
            await asyncio.sleep(room.time_limit)
            # 実行時に再度ルームの存在を確認
            room = self.room_manager.get_room(room_id)
            if not room: return

            res = room.timeout()
            await self.connection_manager.broadcast_battle_state(room_id, res, is_double=room.is_double, room_manager=self.room_manager, time_limit=room.time_limit)
            
            await self._after_turn_action(room_id, room)
        except asyncio.CancelledError:
            pass
