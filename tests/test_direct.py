import asyncio
from greeclimate.discovery import Discovery

async def main():
    discovery = Discovery()
    print("Scanning specific IP...")
    # The signature is search_devices(broadcastAddrs)
    await discovery.search_devices(broadcastAddrs=["192.168.100.106"])
    await asyncio.sleep(5)
    print(discovery.devices())

if __name__ == "__main__":
    asyncio.run(main())
