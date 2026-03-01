import asyncio
import websockets
import json
import sys

async def dummy_player():
    uri = "ws://localhost:8000/ws/double"
    try:
        async with websockets.connect(uri) as ws:
            # 1. Update user info
            await ws.send(json.dumps({
                "type": "update_user_info",
                "info": {"player_id": "dummy_p1_123", "name": "DummyBot", "ability": "fire"}
            }))
            await ws.recv() # Wait for user_info_updated
            
            # 2. Create room
            await ws.send(json.dumps({
                "type": "create_double_room",
                "info": {"player_id": "dummy_p1_123", "mode": "1v1_double"}
            }))
            
            # 3. Get Room ID
            res = await ws.recv()
            data = json.loads(res)
            if data["type"] == "double_room_created":
                print(f"ROOM_ID:{data['room_id']}", flush=True)
            else:
                print(f"FAILED TO CREATE: {data}", flush=True)
                return

            # Keep connection alive and print events
            while True:
                msg = await ws.recv()
                print(f"Event: {msg}", flush=True)
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(dummy_player())
