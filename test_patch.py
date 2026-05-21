import asyncio
from backend.app.gree_manager import gree_manager
import json

async def test():
    class MockDevice:
        def __init__(self):
            self.power = False
            self.vertical_swing = 0
        async def push_state_update(self):
            print("State pushed!")

    gree_manager.devices["test_mac"] = MockDevice()
    await gree_manager.update_device("test_mac", {"power": True})
    print("Device power:", gree_manager.devices["test_mac"].power)

asyncio.run(test())
