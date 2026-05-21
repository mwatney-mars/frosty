import asyncio
import websockets

async def test_ws():
    uri = "ws://localhost:8000/api/ws"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Waiting 10 seconds before closing...")
            msg = await websocket.recv()
            print(f"Received: {msg}")
            await asyncio.sleep(10)
            print("Closing...")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test_ws())
