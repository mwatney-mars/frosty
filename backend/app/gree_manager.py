import asyncio
import logging
import os
from typing import List, Dict, Optional
from greeclimate.discovery import Discovery
from greeclimate.device import Device, DeviceInfo
from .database import SessionLocal, DBDeviceName

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GreeManager:
    def __init__(self):
        self.discovery = None
        self.devices: Dict[str, Device] = {}
        self.device_info: Dict[str, DeviceInfo] = {}

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

    async def discover_devices(self) -> List[Dict]:
        """Discover Gree AC units on the local network."""
        logger.info("Searching for Gree AC units...")
        try:
            if self.discovery is None:
                self.discovery = Discovery()

            target_ips = []
            env_ips = os.getenv("GREE_IPS")
            if env_ips:
                target_ips.extend([ip.strip() for ip in env_ips.split(",")])

            if target_ips:
                logger.info(f"Targeting explicit IPs: {target_ips}")
                await self.discovery.search_devices(broadcastAddrs=target_ips)
            else:
                logger.info("Scanning local network for devices...")
                await self.discovery.search_devices()

            await asyncio.sleep(4)
            discovered = self.discovery.devices
            logger.info(f"Discovered items list: {discovered}")
            
            new_devices = {}
            for info in discovered:
                # Use IP as the unique identifier for now
                device_id = info.ip
                if device_id not in self.devices:
                    device = Device(info)
                    # We need to bind to the device to control it
                    try:
                        await device.bind()
                        self.devices[device_id] = device
                        self.device_info[device_id] = info
                        
                        # Apply custom name if we have one
                        mac = info.mac
                        if mac:
                            custom_name = self.get_custom_name(mac)
                            if custom_name:
                                self.device_info[device_id].name = custom_name
                            
                        logger.info(f"Discovered and bound to device at {info.ip}")
                    except Exception as e:
                        logger.error(f"Failed to bind to device at {info.ip}: {e}")
                else:
                    new_devices[device_id] = self.devices[device_id]
            
            return await self.get_all_states()
        except Exception as e:
            logger.error(f"Discovery error: {e}")
            return []

    async def get_device_state(self, ip: str) -> Optional[Dict]:
        """Get the current state of a specific device."""
        device = self.devices.get(ip)
        if not device:
            return None
        
        try:
            await device.update_state()
            return {
                "ip": ip,
                "name": self.device_info[ip].name,
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
            logger.error(f"Failed to get state for {ip}: {e}")
            return None

    async def get_all_states(self) -> List[Dict]:
        """Get states for all registered devices."""
        states = []
        for ip in list(self.devices.keys()):
            state = await self.get_device_state(ip)
            if state:
                states.append(state)
        return states

    async def update_device(self, ip: str, updates: Dict):
        """Update multiple properties of a device at once."""
        device = self.devices.get(ip)
        if device:
            if "name" in updates:
                new_name = updates.pop("name")
                self.device_info[ip].name = new_name
                # Persist by MAC
                mac = self.device_info[ip].mac
                if mac:
                    self.set_custom_name(mac, new_name)
            
            for key, value in updates.items():
                if key == "swing_vertical":
                    device.vertical_swing = value
                elif hasattr(device, key):
                    setattr(device, key, value)
            
            if updates:
                await device.push_state_update()

    async def set_power(self, ip: str, power: bool):
        device = self.devices.get(ip)
        if device:
            device.power = power
            await device.push_state_update()

    async def set_temperature(self, ip: str, temp: int):
        device = self.devices.get(ip)
        if device:
            device.target_temperature = temp
            await device.push_state_update()

    async def set_fan_speed(self, ip: str, speed: int):
        device = self.devices.get(ip)
        if device:
            device.fan_speed = speed
            await device.push_state_update()

gree_manager = GreeManager()
