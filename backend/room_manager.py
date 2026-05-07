import asyncio
import secrets
import time
from typing import Dict, List, Optional
from collections import defaultdict

try:
    from battle import SingleBattle
    from double_battle import DoubleBattle
except ImportError:
    from backend.battle import SingleBattle
    from backend.double_battle import DoubleBattle

class RoomManager:
    """
    バトルのルーム、マッチメイキング、タイマー、およびユーザープロフィールを一括管理するクラス
    """
    def __init__(self, sb_info, connection_manager):
        self.sb_info = sb_info
        self.connection_manager = connection_manager
        
        # ルーム管理
        self.rooms: Dict[str, SingleBattle | DoubleBattle] = {}
        self.private_waiting_rooms: Dict[str, dict] = {}
        
        # ユーザープロフィール
        self.user_profiles: Dict[str, dict] = {}
        
        # マッチメイキングキュー
        self.waiting_player_standard: Optional[dict] = None
        self.waiting_player_stock: Optional[dict] = None
        self.waiting_player_double: Optional[dict] = None
        self.waiting_player_double_2v2: List[str] = []
        
        # タイマー管理 (room_id -> Timer Task)
        self.room_timers: Dict[str, asyncio.Task] = {}
        
        # クリーンアップタイマー
        self.cleanup_timers: Dict[str, asyncio.Task] = {}
        
        # 最大ルーム数
        self.MAX_ROOMS = 50

    def get_room(self, room_id: str) -> Optional[SingleBattle | DoubleBattle]:
        """指定されたIDのルームを取得"""
        return self.rooms.get(room_id)

    def remove_room(self, room_id: str):
        """ルームと関連するタイマーを削除"""
        if room_id in self.rooms:
            del self.rooms[room_id]
        
        self.cancel_timer(room_id)

    def cancel_timer(self, room_id: str):
        """タイマーをキャンセル"""
        if room_id in self.room_timers:
            self.room_timers[room_id].cancel()
            del self.room_timers[room_id]

    def set_timer(self, room_id: str, task: asyncio.Task):
        """新しいタイマーをセット（既存のものはキャンセル）"""
        self.cancel_timer(room_id)
        self.room_timers[room_id] = task

    def schedule_room_cleanup(self, room_id: str, delay: int = 10):
        """試合終了後にルームを自動削除（メモリリーク対策）"""
        if room_id in self.cleanup_timers:
            self.cleanup_timers[room_id].cancel()
        
        async def _cleanup_task():
            await asyncio.sleep(delay)
            self.remove_room(room_id)
            if room_id in self.cleanup_timers:
                del self.cleanup_timers[room_id]
                
        self.cleanup_timers[room_id] = asyncio.create_task(_cleanup_task())

    async def handle_disconnection(self, room_id: str, player_id: str):
        """猶予なしで即座に切断処理（敗北確定）を行う"""
        room = self.get_room(room_id)
        if not room or room.is_finished:
            return

        res = room.handle_disconnection(player_id)
        if res:
            is_double = room.is_double
            await self.connection_manager.broadcast_battle_state(
                room_id, res, is_double=is_double, room_manager=self, time_limit=room.time_limit
            )
        
        if room.is_finished:
            self.cancel_timer(room_id)
            self.schedule_room_cleanup(room_id)

    def get_player_name(self, player_id: str) -> str:
        """プレイヤー名を取得（プロフィールがない場合はデフォルト名）"""
        prof = self.user_profiles.get(player_id)
        if prof and prof.get("name"):
            return prof["name"]
        return "じぶん"

    def update_user_info(self, player_id: str, name: str, ability: str, ability_2: Optional[str] = None):
        """ユーザープロフィールの更新"""
        if not name: name = "じぶん"
        if len(name) > 8: name = name[:8]
        self.user_profiles[player_id] = {"name": name, "ability": ability, "ability_2": ability_2}

    def create_private_room(self, websocket, player_id: str, p1_lives: int, p2_lives: int, is_double: bool = False) -> str:
        """プライベートルームを作成してIDを返す"""
        while True:
            new_room_id = f"{secrets.randbelow(1000000):06d}"
            if new_room_id not in self.private_waiting_rooms: break
        
        self.private_waiting_rooms[new_room_id] = {
            "socket": websocket, 
            "player_id": player_id, 
            "p1_max_lives": p1_lives,
            "p2_max_lives": p2_lives,
            "is_double": is_double
        }
        return new_room_id
