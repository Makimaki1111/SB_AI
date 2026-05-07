
import sys
import os
import asyncio
from unittest.mock import MagicMock, AsyncMock

# backendディレクトリをパスに追加
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from battle import SingleBattle
from SB_info import SB_info
from room_manager import RoomManager

async def test_immediate_disconnection():
    print("=== Testing Immediate Disconnection ===")
    
    # Mock dependencies
    sb_info = MagicMock(spec=SB_info)
    sb_info.get_next_initial.return_value = "い"
    
    conn_manager = MagicMock()
    conn_manager.broadcast_battle_state = AsyncMock()
    
    room_manager = RoomManager(sb_info, conn_manager)
    
    # Create a room
    room_id = "test_room"
    battle = SingleBattle("p1", "p2", sb_info, room_id=room_id)
    room_manager.rooms[room_id] = battle
    
    print(f"Initial Finished State: {battle.is_finished}")
    
    # Simulate disconnection of p2
    print("Simulating disconnection of p2 (Team 1)...")
    await room_manager.handle_disconnection(room_id, "p2")
    
    # Verify results
    print(f"Finished State after disconnection: {battle.is_finished}")
    print(f"Winner Team: {battle.winner_team}") # p2 is Team 1, so p1 (Team 0) should win
    
    if battle.is_finished and battle.winner_team == 0:
        print("SUCCESS: Battle finished immediately and Team 0 won.")
    else:
        print(f"FAILURE: Unexpected state. Finished={battle.is_finished}, Winner={battle.winner_team}")

    # Verify cleanup scheduling
    if room_id in room_manager.cleanup_timers:
        print("SUCCESS: Room cleanup scheduled.")
    else:
        print("FAILURE: Room cleanup NOT scheduled.")

if __name__ == "__main__":
    asyncio.run(test_immediate_disconnection())
