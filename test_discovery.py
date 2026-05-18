import asyncio
from greeclimate.discovery import Discovery

async def main():
    discovery = Discovery()
    print("Scanning without hardcoded IP...")
    # Passing None to broadcast to all interfaces
    await discovery.search_devices(broadcastAddrs=None)
    await asyncio.sleep(5)
    print(discovery.devices)

if __name__ == "__main__":
    asyncio.run(main())
