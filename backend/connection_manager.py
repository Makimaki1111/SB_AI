import logging
import json
from typing import Dict, List, Optional
from collections import defaultdict
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # アクティブな全接続リスト
        self.active_connections: List[WebSocket] = []
        # room_id ごとの接続リスト
        self.room_connections: Dict[str, List[WebSocket]] = defaultdict(list)
        # WebSocket -> player_id のマッピング
        self.socket_to_player_id: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        host = websocket.client.host if websocket.client else "unknown"
        logger.info(f"New WebSocket connection from {host}")

    def disconnect(self, websocket: WebSocket):
        left_rooms = []
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        # 各部屋からも削除
        for room_id in list(self.room_connections.keys()):
            if websocket in self.room_connections[room_id]:
                self.room_connections[room_id].remove(websocket)
                if not self.room_connections[room_id]:
                    del self.room_connections[room_id]
                left_rooms.append(room_id)
        if websocket in self.socket_to_player_id:
            del self.socket_to_player_id[websocket]
        return left_rooms

    def register_player(self, websocket: WebSocket, player_id: str):
        self.socket_to_player_id[websocket] = player_id

    def get_player_id(self, websocket: WebSocket) -> Optional[str]:
        return self.socket_to_player_id.get(websocket)

    def join_room(self, websocket: WebSocket, room_id: str):
        if websocket not in self.room_connections[room_id]:
            self.room_connections[room_id].append(websocket)

    async def safe_send_text(self, websocket: WebSocket, message: str) -> bool:
        try:
            await websocket.send_text(message)
            return True
        except Exception:
            self.disconnect(websocket)
            return False

    async def broadcast(self, message: str, room_id: str):
        for connection in list(self.room_connections.get(room_id, [])):
            await self.safe_send_text(connection, message)

    async def broadcast_battle_state(self, room_id: str, base_response: dict, is_double: bool = False, room_manager = None, time_limit: int = None):
        """
        ルーム内の全員に戦況を送信する。
        各プレイヤーの視点に合わせてデータをパーソナライズする。
        """
        if not room_manager:
            # フォールバック
            await self.broadcast(json.dumps(base_response), room_id)
            return

        room = room_manager.get_room(room_id)
        if not room: return

        for connection in list(self.room_connections.get(room_id, [])):
            pid = self.socket_to_player_id.get(connection)
            # パーソナライズされたレスポンスを生成
            personalized_res = room.get_personalized_response(base_response, pid, time_limit=time_limit) if pid else base_response
            
            await self.safe_send_text(connection, json.dumps(personalized_res))
