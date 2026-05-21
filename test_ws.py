import asyncio
import websockets

async def test_ws():
    uri = "ws://localhost:8000/api/ws"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
            msg = await websocket.recv()
            print(f"Received: {msg}")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test_ws())
