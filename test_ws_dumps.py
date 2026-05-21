import asyncio
import json
from backend.app.gree_manager import gree_manager

async def test():
    try:
        states = await gree_manager.get_all_states()
        print("States raw:", states)
        states_json = json.dumps(states)
        print("States JSON:", states_json)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(test())
