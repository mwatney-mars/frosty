import asyncio
import logging
import os
from typing import List, Dict, Optional
from greeclimate.discovery import Discovery
from greeclimate.device import Device, DeviceInfo
from .database import SessionLocal, DBDeviceName, get_all_saved_devices, add_saved_device, delete_saved_device, get_device_name

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GreeManager:
    def __init__(self):
        self._discovery = None
        self.devices: Dict[str, Device] = {} # Keyed by MAC
        self.device_info: Dict[str, DeviceInfo] = {} # Keyed by MAC
        self._last_scan_results: List[DeviceInfo] = []
        self.custom_names: Dict[str, str] = {} # Keyed by MAC (Cache)
        self.names_loaded = False
        self.failed_pings: Dict[str, int] = {} # Keyed by MAC (Consecutive failures)

    def _get_discovery(self):
        if self._discovery is None:
            self._discovery = Discovery()
        return self._discovery

    def get_custom_name(self, mac: str) -> Optional[str]:
        if not self.names_loaded:
            db = SessionLocal()
            try:
                for device in get_all_saved_devices(db):
                    self.custom_names[device.mac] = device.name
                self.names_loaded = True
            except Exception as e:
                logger.error(f"Failed to populate names cache: {e}")
            finally:
                db.close()
        return self.custom_names.get(mac)

    async def discover_devices(self):
        """Background discovery to find and bind SAVED devices."""
        logger.info("Running network scan for devices...")
        try:
            discovery = self._get_discovery()
            
            target_ips = []
            env_ips = os.getenv("GREE_IPS")
            if env_ips:
                target_ips.extend([ip.strip() for ip in env_ips.split(",")])

            if target_ips:
                await discovery.search_devices(broadcastAddrs=target_ips)
            else:
                await discovery.search_devices()

            # Wait for responses to arrive
            await asyncio.sleep(5)
            self._last_scan_results = discovery.devices
            logger.info(f"Scan complete. Found {len(self._last_scan_results)} total devices on network.")
            
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
                            logger.error(f"Failed to bind to saved device {info.mac} at {info.ip}: {e}")
        except Exception as e:
            logger.error(f"Discovery error: {e}")

    async def scan_for_new_devices(self) -> List[Dict]:
        """Scan and return devices NOT in the saved list."""
        await self.discover_devices() # Refresh results
        
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
        
        logger.info(f"Returning {len(unsaved)} new devices to frontend.")
        return unsaved

    async def add_saved_device(self, mac: str, name: str):
        """Add a device to persistence and try to bind it."""
        db = SessionLocal()
        try:
            add_saved_device(db, mac, name)
            self.custom_names[mac] = name  # Update cache
            self.failed_pings[mac] = 0     # Initialize error count
        finally:
            db.close()
            
        # Check if we saw it in the last scan
        found = False
        for info in self._last_scan_results:
            if info.mac == mac:
                found = True
                device = Device(info)
                try:
                    await device.bind()
                    self.devices[mac] = device
                    self.device_info[mac] = info
                    logger.info(f"Successfully added and bound new device {mac}")
                except Exception as e:
                    logger.error(f"Failed to bind newly added device {mac}: {e}")
                break
        
        if not found:
             logger.warning(f"Device {mac} not found in latest scan results, cannot bind immediately.")

    async def remove_saved_device(self, mac: str):
        """Remove device from persistence and in-memory tracking."""
        db = SessionLocal()
        try:
            delete_saved_device(db, mac)
            self.custom_names.pop(mac, None)  # Update cache
            self.failed_pings.pop(mac, None)  # Clear consecutive failures
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
                "ip": self.device_info[mac].ip if mac in self.device_info else "Unknown"
            }
        
        try:
            await device.update_state()
            self.failed_pings[mac] = 0 # Reset failures on successful update
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
            self.failed_pings[mac] = self.failed_pings.get(mac, 0) + 1
            
            # If failed less than 3 consecutive times, tolerate it and return the last known properties
            if self.failed_pings[mac] < 3:
                logger.info(f"Tolerating failure for device {mac} ({self.failed_pings[mac]}/3 failures). Returning cached values.")
                return {
                    "mac": mac,
                    "ip": self.device_info[mac].ip if mac in self.device_info else "Unknown",
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
            
            # 3 or more failures, mark as offline
            return {
                "mac": mac,
                "name": custom_name,
                "online": False,
                "ip": self.device_info[mac].ip if mac in self.device_info else "Unknown"
            }

    async def get_all_states(self) -> List[Dict]:
        """Get states for all SAVED devices in parallel."""
        # Ensure name cache is populated
        if not self.names_loaded:
            db = SessionLocal()
            try:
                for device in get_all_saved_devices(db):
                    self.custom_names[device.mac] = device.name
                self.names_loaded = True
            except Exception as e:
                logger.error(f"Failed to populate names cache: {e}")
            finally:
                db.close()
                
        if not self.custom_names:
            return []

        tasks = [self.get_device_state(mac) for mac in self.custom_names.keys()]
        states = await asyncio.gather(*tasks)
        
        return [s for s in states if s is not None]

    async def update_device(self, identifier: str, updates: Dict):
        """Update multiple properties of a device at once."""
        mac = identifier
        device = self.devices.get(mac)
        
        # Fallback for old cached mobile clients that still use IP in the URL path
        if not device:
            for m, info in self.device_info.items():
                if info.ip == identifier:
                    mac = m
                    device = self.devices.get(mac)
                    break

        if "name" in updates:
            new_name = updates.pop("name")
            db = SessionLocal()
            try:
                add_saved_device(db, mac, new_name)
                self.custom_names[mac] = new_name  # Update cache
            finally:
                db.close()
        
        if device:
            for key, value in updates.items():
                if key == "swing_vertical":
                    device.vertical_swing = value
                elif hasattr(device, key):
                    setattr(device, key, value)
            
            if updates:
                await device.push_state_update()

gree_manager = GreeManager()
