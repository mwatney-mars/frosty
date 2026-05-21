from greeclimate.device import Device, DeviceInfo
import asyncio
async def test():
    class DummyInfo:
        mac = "test"
        ip = "127.0.0.1"
        port = 7000
    d = Device(DummyInfo())
    print("power:", hasattr(d, "power"))
    print("target_temperature:", hasattr(d, "target_temperature"))
    print("fan_speed:", hasattr(d, "fan_speed"))
asyncio.run(test())
