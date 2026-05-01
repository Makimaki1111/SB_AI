import asyncio
import secrets
import time
from typing import Dict, List, Optional
from collections import defaultdict

try:
    from battle import Battle_info
    from double_battle import DoubleBattle_info
except ImportError:
    from backend.battle import Battle_info
    from backend.double_battle import DoubleBattle_info

class RoomManager:
    """
    バトルのルーム、マッチメイキング、タイマー、およびユーザープロフィールを一括管理するクラス
    """
    def __init__(self, sb_info, connection_manager):
        self.sb_info = sb_info
        self.connection_manager = connection_manager
        
        # ルーム管理
        self.battle_rooms: Dict[str, Battle_info] = {}
        self.double_battle_rooms: Dict[str, DoubleBattle_info] = {}
        self.private_rooms: Dict[str, dict] = {}
        self.double_private_rooms: Dict[str, dict] = {}
        
        # ユーザープロフィール
        self.user_profiles: Dict[str, dict] = {}
        
        # マッチメイキングキュー
        self.waiting_player_standard: Optional[dict] = None
        self.waiting_player_stock: Optional[dict] = None
        self.waiting_player_double: Optional[dict] = None
        self.waiting_player_double_2v2: List[str] = []
        
        # タイマー管理 (room_id -> Timer Task)
        self.room_timers: Dict[str, asyncio.Task] = {}
        
        # 最大ルーム数
        self.MAX_ROOMS = 50

    def get_room(self, room_id: str) -> Optional[Battle_info | DoubleBattle_info]:
        """指定されたIDのルームを取得（シングル・ダブル両対応）"""
        if room_id in self.battle_rooms:
            return self.battle_rooms[room_id]
        return self.double_battle_rooms.get(room_id)

    def remove_room(self, room_id: str):
        """ルームと関連するタイマーを削除"""
        if room_id in self.battle_rooms:
            del self.battle_rooms[room_id]
        if room_id in self.double_battle_rooms:
            del self.double_battle_rooms[room_id]
        
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

    def get_player_name(self, player_id: str) -> str:
        """プレイヤー名を取得（プロフィールがない場合はデフォルト名）"""
        prof = self.user_profiles.get(player_id)
        if prof and prof.get("name"):
            return prof["name"]
        return "じぶん"

    def update_user_info(self, player_id: str, name: str, ability: str):
        """ユーザープロフィールの更新"""
        if not name: name = "じぶん"
        if len(name) > 8: name = name[:8]
        self.user_profiles[player_id] = {"name": name, "ability": ability}

    def create_private_room(self, websocket, player_id: str, p1_lives: int, p2_lives: int, is_double: bool = False) -> str:
        """プライベートルームを作成してIDを返す"""
        target_dict = self.double_private_rooms if is_double else self.private_rooms
        while True:
            new_room_id = f"{secrets.randbelow(1000000):06d}"
            if new_room_id not in self.private_rooms and new_room_id not in self.double_private_rooms: break
        
        target_dict[new_room_id] = {
            "socket": websocket, 
            "player_id": player_id, 
            "p1_max_lives": p1_lives,
            "p2_max_lives": p2_lives
        }
        return new_room_id
