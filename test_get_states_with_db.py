import asyncio
from backend.app.database import SessionLocal, add_saved_device
from backend.app.gree_manager import gree_manager

def setup():
    db = SessionLocal()
    add_saved_device(db, "12:34:56:78", "Test AC")
    db.close()

async def test():
    try:
        states = await gree_manager.get_all_states()
        print("States:", states)
    except Exception as e:
        print(f"Exception: {repr(e)}")

setup()
asyncio.run(test())
