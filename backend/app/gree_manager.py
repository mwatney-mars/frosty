import asyncio
import logging
import os
from typing import List, Dict, Optional
from greeclimate.discovery import Discovery
from greeclimate.device import Device, DeviceInfo
from .database import SessionLocal, DBDeviceName, get_all_saved_devices

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GreeManager:
    def __init__(self):
        self.discovery = None
        self.devices: Dict[str, Device] = {} # Keyed by MAC
        self.device_info: Dict[str, DeviceInfo] = {} # Keyed by MAC
        self._last_scan_results: List[DeviceInfo] = []

    def get_custom_name(self, mac: str) -> Optional[str]:
        db = SessionLocal()
        try:
            device = db.query(DBDeviceName).filter(DBDeviceName.mac == mac).first()
            return device.name if device else None
        finally:
            db.close()

    def set_custom_name(self, mac: str, name: str):
        db = SessionLocal()
        try:
            device = db.query(DBDeviceName).filter(DBDeviceName.mac == mac).first()
            if device:
                device.name = name
            else:
                new_device = DBDeviceName(mac=mac, name=name)
                db.add(new_device)
            db.commit()
        finally:
            db.close()

    async def discover_devices(self):
        """Background discovery to find and bind SAVED devices."""
        logger.info("Running network scan for saved devices...")
        try:
            if self.discovery is None:
                self.discovery = Discovery()

            target_ips = []
            env_ips = os.getenv("GREE_IPS")
            if env_ips:
                target_ips.extend([ip.strip() for ip in env_ips.split(",")])

            if target_ips:
                await self.discovery.search_devices(broadcastAddrs=target_ips)
            else:
                await self.discovery.search_devices()

            await asyncio.sleep(4)
            self._last_scan_results = self.discovery.devices
            
            # Get saved MACs from DB
            db = SessionLocal()
            saved_devices = get_all_saved_devices(db)
            saved_macs = {d.mac for d in saved_devices}
            db.close()

            for info in self._last_scan_results:
                if info.mac in saved_macs:
                    # It's a saved device, bind it if not already bound or if IP changed
                    if info.mac not in self.devices or self.device_info[info.mac].ip != info.ip:
                        device = Device(info)
                        try:
                            await device.bind()
                            self.devices[info.mac] = device
                            self.device_info[info.mac] = info
                            logger.info(f"Bound to saved device {info.mac} at {info.ip}")
                        except Exception as e:
                            logger.error(f"Failed to bind to {info.mac} at {info.ip}: {e}")
        except Exception as e:
            logger.error(f"Discovery error: {e}")

    async def scan_for_new_devices(self) -> List[Dict]:
        """Scan and return devices NOT in the saved list."""
        await self.discover_devices() # Refresh list
        
        db = SessionLocal()
        saved_devices = get_all_saved_devices(db)
        saved_macs = {d.mac for d in saved_devices}
        db.close()

        unsaved = []
        for info in self._last_scan_results:
            if info.mac not in saved_macs:
                unsaved.append({
                    "mac": info.mac,
                    "ip": info.ip,
                    "name": info.name or "Gree AC"
                })
        return unsaved

    async def add_saved_device(self, mac: str, name: str):
        """Add a device to persistence and try to bind it."""
        self.set_custom_name(mac, name)
        # Check if we saw it in the last scan
        for info in self._last_scan_results:
            if info.mac == mac:
                device = Device(info)
                try:
                    await device.bind()
                    self.devices[mac] = device
                    self.device_info[mac] = info
                except Exception as e:
                    logger.error(f"Failed to bind newly added device {mac}: {e}")
                break

    async def remove_saved_device(self, mac: str):
        """Remove device from persistence and in-memory tracking."""
        db = SessionLocal()
        try:
            device = db.query(DBDeviceName).filter(DBDeviceName.mac == mac).first()
            if device:
                db.delete(device)
                db.commit()
        finally:
            db.close()
        
        if mac in self.devices:
            del self.devices[mac]
        if mac in self.device_info:
            del self.device_info[mac]

    async def get_device_state(self, mac: str) -> Optional[Dict]:
        """Get state of a saved device, handling offline status."""
        custom_name = self.get_custom_name(mac)
        if not custom_name:
            return None # Not a saved device

        device = self.devices.get(mac)
        if not device:
            return {
                "mac": mac,
                "name": custom_name,
                "online": False,
                "ip": "Unknown"
            }
        
        try:
            await device.update_state()
            return {
                "mac": mac,
                "ip": self.device_info[mac].ip,
                "name": custom_name,
                "online": True,
                "power": device.power,
                "target_temperature": device.target_temperature,
                "current_temperature": device.current_temperature,
                "fan_speed": device.fan_speed,
                "mode": device.mode,
                "swing_vertical": device.vertical_swing,
                "horizontal_swing": device.horizontal_swing,
                "quiet": device.quiet,
                "turbo": device.turbo,
                "light": device.light,
                "sleep": device.sleep,
                "xfan": device.xfan,
                "anion": device.anion,
                "power_save": device.power_save,
                "steady_heat": device.steady_heat
            }
        except Exception as e:
            logger.error(f"Failed to update state for {mac}: {e}")
            return {
                "mac": mac,
                "name": custom_name,
                "online": False,
                "ip": self.device_info[mac].ip
            }

    async def get_all_states(self) -> List[Dict]:
        """Get states for all SAVED devices in parallel."""
        db = SessionLocal()
        saved_devices = get_all_saved_devices(db)
        db.close()
        
        tasks = [self.get_device_state(d.mac) for d in saved_devices]
        states = await asyncio.gather(*tasks)
        
        # Filter out None results and return
        return [s for s in states if s is not None]

    async def update_device(self, mac: str, updates: Dict):
        """Update multiple properties of a device at once."""
        device = self.devices.get(mac)
        if "name" in updates:
            new_name = updates.pop("name")
            self.set_custom_name(mac, new_name)
        
        if device:
            for key, value in updates.items():
                if key == "swing_vertical":
                    device.vertical_swing = value
                elif hasattr(device, key):
                    setattr(device, key, value)
            
            if updates:
                await device.push_state_update()

    async def set_power(self, mac: str, power: bool):
        device = self.devices.get(mac)
        if device:
            device.power = power
            await device.push_state_update()

    async def set_temperature(self, mac: str, temp: int):
        device = self.devices.get(mac)
        if device:
            device.target_temperature = temp
            await device.push_state_update()

    async def set_fan_speed(self, mac: str, speed: int):
        device = self.devices.get(mac)
        if device:
            device.fan_speed = speed
            await device.push_state_update()

gree_manager = GreeManager()
