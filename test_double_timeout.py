import asyncio
import websockets
import json

async def test_timeout():
    uri = "ws://localhost:8000/ws/double"
    async with websockets.connect(uri) as websocket:
        await websocket.send(json.dumps({
            "type": "update_user_info",
            "info": {
                "player_id": "test_player",
                "name": "Bot",
                "ability": ""
            }
        }))
        
        await websocket.send(json.dumps({
            "type": "join_double_cpu_room",
            "info": {"player_id": "test_player"}
        }))

        try:
            while True:
                response = await asyncio.wait_for(websocket.recv(), timeout=25.0)
                data = json.loads(response)
                print(f"Received JSON: {json.dumps(data, ensure_ascii=False, indent=2)}")
                if data["type"] == "turn_result":
                    for event in data["events"]:
                        if "時間切れ" in event.get("message", ""):
                            print("TIMEOUT SUCCESSFULLY TRIGGERED!")
                            return
        except asyncio.TimeoutError:
            print("FAILED: No timeout received after 25 seconds.")
            return

asyncio.run(test_timeout())
