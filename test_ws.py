import json
import asyncio
import websockets

async def test_double_ws():
    uri = "ws://localhost:8000/ws/double"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected.")
            
            # 1. Update user info
            req1 = {
                "type": "update_user_info",
                "info": {
                    "player_id": "test_player1",
                    "name": "tester",
                    "ability": "fire"
                }
            }
            await websocket.send(json.dumps(req1))
            res1 = await websocket.recv()
            print(f"Recv 1: {res1}")

            # 2. Create room
            req2 = {
                "type": "create_double_room",
                "info": {
                    "player_id": "test_player1",
                    "mode": "1v1_double"
                }
            }
            await websocket.send(json.dumps(req2))
            
            try:
                res2 = await websocket.recv()
                print(f"Recv 2: {res2}")
                # Wait a bit to see if server closes
                res3 = await websocket.recv()
                print(f"Recv 3: {res3}")
            except websockets.exceptions.ConnectionClosed as e:
                print(f"Connection closed by server. Code: {e.code}, Reason: '{e.reason}'")

    except Exception as e:
        print(f"Failed to connect: {e}")

if __name__ == "__main__":
    asyncio.run(test_double_ws())
