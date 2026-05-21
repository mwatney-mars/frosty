import asyncio
from backend.app.gree_manager import gree_manager

async def test():
    try:
        states = await gree_manager.get_all_states()
        print("States:", states)
    except Exception as e:
        print(f"Exception: {repr(e)}")

asyncio.run(test())
