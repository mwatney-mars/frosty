from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import OAuth2PasswordRequestForm
import json
import asyncio
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
from datetime import timedelta
from sqlalchemy.orm import Session

from .gree_manager import gree_manager
from .auth import (
    authenticate_user, 
    create_access_token, 
    get_current_user, 
    User, 
    UserCreate, 
    UserUpdate,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_user,
    update_user_db,
    delete_user_db
)
from .database import init_db, get_db

# Initialize database
init_db()

app = FastAPI(title="Gree AC Controller API")

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        try:
            await websocket.accept()
            self.active_connections.append(websocket)
            return True
        except Exception:
            return False

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

async def state_broadcaster():
    while True:
        try:
            if manager.active_connections:
                states = await gree_manager.get_all_states()
                await manager.broadcast(json.dumps(states))
        except Exception as e:
            print(f"Broadcast error: {e}")
        await asyncio.sleep(5) # Broadcast every 5 seconds to reduce noise

async def background_discovery():
    """Periodically scan for saved devices that might have come back online."""
    while True:
        try:
            await gree_manager.discover_devices()
        except Exception as e:
            print(f"Background discovery error: {e}")
        await asyncio.sleep(60) # Scan every 60 seconds

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None, db: Session = Depends(get_db)):
    if not token:
        # Reject handshake if token is missing
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Token missing")
        return
        
    try:
        from .auth import get_current_user
        # Decodes token and raises HTTP 401 if invalid or expired
        get_current_user(token=token, db=db)
    except Exception:
        # Reject handshake if token is invalid or expired
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return

    if await manager.connect(websocket):
        try:
            # Allow tunnel handshakes (e.g. Cloudflare) to fully resolve 
            # before we blast the first data frame.
            await asyncio.sleep(0.2)
            
            # Send initial state
            states = await gree_manager.get_all_states()
            await websocket.send_text(json.dumps(states))
            
            while True:
                # Keep connection alive
                await websocket.receive_text()
        except (WebSocketDisconnect, Exception) as e:
            print(f"WS Exception: {repr(e)}")
            manager.disconnect(websocket)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Token(BaseModel):
    access_token: str
    token_type: str

class DeviceState(BaseModel):
    mac: str
    ip: str
    name: str
    online: bool
    power: Optional[bool] = None
    target_temperature: Optional[int] = None
    current_temperature: Optional[int] = None
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

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    power: Optional[bool] = None
    target_temperature: Optional[int] = None
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

class DeviceSaveRequest(BaseModel):
    mac: str
    name: str
    ip: Optional[str] = None

class DiscoveredDevice(BaseModel):
    mac: str
    ip: str
    name: str

class PowerRequest(BaseModel):
    power: bool

class TemperatureRequest(BaseModel):
    temperature: int

class FanSpeedRequest(BaseModel):
    fan_speed: int

@app.on_event("startup")
async def startup_event():
    import asyncio
    async def run_initial_discovery():
        await gree_manager.discover_devices()
        # Broadcast immediately after initial discovery finishes
        try:
            states = await gree_manager.get_all_states()
            await manager.broadcast(json.dumps(states))
        except Exception:
            pass

    asyncio.create_task(run_initial_discovery())
    asyncio.create_task(state_broadcaster())
    asyncio.create_task(background_discovery())

@app.post("/api/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.get("/api/users", response_model=List[User])
async def list_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    from .database import DBUser
    users = db.query(DBUser).all()
    return [User(username=u.username, is_admin=u.is_admin) for u in users]

@app.post("/api/users", response_model=User)
async def api_create_user(user: UserCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        return create_user(db, user.dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/api/users/{username}", response_model=User)
async def api_update_user(username: str, updates: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Users can update themselves, or admins can update anyone
    if not current_user.is_admin and current_user.username != username:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    updated = update_user_db(db, username, updates.dict(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return updated

@app.delete("/api/users/{username}")
async def api_delete_user(username: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user.username == username:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    if not delete_user_db(db, username):
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success"}

@app.get("/api/devices", response_model=List[DeviceState])
async def get_devices(current_user: User = Depends(get_current_user)):
    return await gree_manager.get_all_states()

@app.post("/api/devices", response_model=DeviceState)
async def save_device(request: DeviceSaveRequest, current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    await gree_manager.add_saved_device(request.mac, request.name)
    state = await gree_manager.get_device_state(request.mac)
    if not state:
        raise HTTPException(status_code=500, detail="Failed to retrieve device state after saving")
    return state

@app.delete("/api/devices/{mac}")
async def delete_device(mac: str, current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    await gree_manager.remove_saved_device(mac)
    return {"status": "success"}

@app.get("/api/discover", response_model=List[DiscoveredDevice])
async def discover_new_devices(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    return await gree_manager.scan_for_new_devices()

@app.patch("/api/devices/{mac}")
async def update_device(mac: str, updates: DeviceUpdate, current_user: User = Depends(get_current_user)):
    data = updates.dict(exclude_unset=True)
    await gree_manager.update_device(mac, data)
    
    # Broadcast updated states
    states = await gree_manager.get_all_states()
    await manager.broadcast(json.dumps(states))
    
    return await gree_manager.get_device_state(mac)

@app.post("/api/devices/{mac}/power")
async def set_power(mac: str, request: PowerRequest, current_user: User = Depends(get_current_user)):
    await gree_manager.update_device(mac, {"power": request.power})
    states = await gree_manager.get_all_states()
    await manager.broadcast(json.dumps(states))
    return await gree_manager.get_device_state(mac)

@app.post("/api/devices/{mac}/temperature")
async def set_temperature(mac: str, request: TemperatureRequest, current_user: User = Depends(get_current_user)):
    await gree_manager.update_device(mac, {"target_temperature": request.temperature})
    states = await gree_manager.get_all_states()
    await manager.broadcast(json.dumps(states))
    return await gree_manager.get_device_state(mac)

@app.post("/api/devices/{mac}/fan_speed")
async def set_fan_speed(mac: str, request: FanSpeedRequest, current_user: User = Depends(get_current_user)):
    await gree_manager.update_device(mac, {"fan_speed": request.fan_speed})
    states = await gree_manager.get_all_states()
    await manager.broadcast(json.dumps(states))
    return await gree_manager.get_device_state(mac)

# Frontend static files serving
frontend_path = os.path.join(os.getcwd(), "frontend", "dist")
if os.path.exists(frontend_path):
    assets_path = os.path.join(frontend_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/{fallback:path}")
    async def read_index(fallback: str):
        if fallback.startswith("api/"):
             raise HTTPException(status_code=404, detail="Not Found")
        
        file_path = os.path.join(frontend_path, fallback)
        if fallback and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        return FileResponse(os.path.join(frontend_path, "index.html"))
else:
    print(f"Frontend dist path not found: {frontend_path}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
