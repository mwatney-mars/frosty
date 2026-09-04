import re
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, ConfigDict

MAC_REGEX = re.compile(r"^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$|^[0-9A-Fa-f]{12}$")
USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9_-]{3,32}$")

class Token(BaseModel):
    access_token: str
    token_type: str

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    is_admin: bool = False
    requires_password_change: bool = False

class User(UserBase):
    pass

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=8, max_length=128)
    is_admin: bool = False

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not USERNAME_REGEX.match(v):
            raise ValueError("Username must be 3-32 characters long and contain only letters, numbers, underscores, and hyphens.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v.strip()) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return v

class UserUpdate(BaseModel):
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    is_admin: Optional[bool] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return v

class DeviceState(BaseModel):
    mac: str
    ip: str
    name: str
    online: bool
    power: Optional[bool] = None
    target_temperature: Optional[float] = None
    current_temperature: Optional[float] = None
    fan_speed: Optional[int] = None
    mode: Optional[int] = None
    swing_vertical: Optional[int] = None
    horizontal_swing: Optional[int] = None
    quiet: Optional[int] = None
    turbo: Optional[bool] = None
    light: Optional[bool] = None
    sleep: Optional[bool] = None
    xfan: Optional[bool] = None
    anion: Optional[bool] = None
    power_save: Optional[bool] = None
    steady_heat: Optional[bool] = None
    mute_beep: Optional[bool] = None

class DeviceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(None, min_length=1, max_length=64)
    power: Optional[bool] = None
    target_temperature: Optional[float] = Field(None, ge=16.0, le=30.0)
    fan_speed: Optional[int] = Field(None, ge=0, le=5)
    mode: Optional[int] = Field(None, ge=0, le=4)
    swing_vertical: Optional[int] = Field(None, ge=0, le=5)
    horizontal_swing: Optional[int] = Field(None, ge=0, le=5)
    quiet: Optional[int] = Field(None, ge=0, le=1)
    turbo: Optional[bool] = None
    light: Optional[bool] = None
    sleep: Optional[bool] = None
    xfan: Optional[bool] = None
    anion: Optional[bool] = None
    power_save: Optional[bool] = None
    steady_heat: Optional[bool] = None
    mute_beep: Optional[bool] = None

class DeviceSaveRequest(BaseModel):
    mac: str = Field(..., min_length=12, max_length=17)
    name: str = Field(..., min_length=1, max_length=64)
    ip: Optional[str] = Field(None, max_length=64)

    @field_validator("mac")
    @classmethod
    def validate_mac(cls, v: str) -> str:
        if not MAC_REGEX.match(v):
            raise ValueError("Invalid MAC address format.")
        return v

class DiscoveredDevice(BaseModel):
    mac: str
    ip: str
    name: str

class PowerRequest(BaseModel):
    power: bool

class TemperatureRequest(BaseModel):
    temperature: float = Field(..., ge=16.0, le=30.0)

class FanSpeedRequest(BaseModel):
    fan_speed: int = Field(..., ge=0, le=5)
