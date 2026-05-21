from pydantic import BaseModel

class PowerRequest(BaseModel):
    power: bool

class TemperatureRequest(BaseModel):
    temperature: int

class FanSpeedRequest(BaseModel):
    fan_speed: int
