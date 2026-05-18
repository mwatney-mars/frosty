from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, status, WebSocket, WebSocketDisconnect
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

from .database import init_db, get_db, DBUser
from .gree_manager import gree_manager
from .auth import (
    authenticate_user, 
    create_access_token, 
    get_current_user, 
    ACCESS_TOKEN_EXPIRE_MINUTES,
    User,
    create_user,
    update_user_db,
    delete_user_db
)
from fastapi.security import OAuth2PasswordRequestForm

# Initialize the database
init_db()

app = FastAPI(title="Gree AC Controller API")

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

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
        await asyncio.sleep(2) # Broadcast every 2 seconds

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection open
            await websocket.receive_text()
    except WebSocketDisconnect:
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
    ip: str
    name: str
    power: bool
    target_temperature: int
    current_temperature: int
    fan_speed: int
    mode: int
    swing_vertical: int
    horizontal_swing: int
    quiet: int
    turbo: bool
    light: bool
    sleep: bool
    xfan: bool
    anion: bool
    power_save: bool
    steady_heat: bool

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

class PowerRequest(BaseModel):
    power: bool

class TemperatureRequest(BaseModel):
    temperature: int

class FanSpeedRequest(BaseModel):
    fan_speed: int

class UserCreate(BaseModel):
    username: str
    password: str
    is_admin: bool = False

class UserUpdate(BaseModel):
    password: Optional[str] = None
    is_admin: Optional[bool] = None

@app.on_event("startup")
async def startup_event():
    import asyncio
    asyncio.create_task(gree_manager.discover_devices())
    asyncio.create_task(state_broadcaster())

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
    users = db.query(DBUser).all()
    return [User(username=u.username, is_admin=u.is_admin) for u in users]

@app.post("/api/users", response_model=User)
async def add_user(user: UserCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        return create_user(db, user.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/api/users/{username}", response_model=User)
async def update_user(username: str, updates: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin and current_user.username != username:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    data = updates.model_dump(exclude_unset=True)
    if not current_user.is_admin and "is_admin" in data:
        data.pop("is_admin")
        
    updated = update_user_db(db, username, data)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return updated

@app.delete("/api/users/{username}")
async def delete_user(username: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user.username == username:
        raise HTTPException(status_code=400, detail="Cannot delete self")
    
    if delete_user_db(db, username):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="User not found")

@app.get("/api/devices", response_model=List[DeviceState])
async def get_devices(current_user: User = Depends(get_current_user)):
    return await gree_manager.get_all_states()

@app.post("/api/discover")
async def discover_devices(background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    return await gree_manager.discover_devices()

@app.patch("/api/devices/{ip}")
async def update_device(ip: str, request: DeviceUpdate, current_user: User = Depends(get_current_user)):
    try:
        data = request.model_dump(exclude_unset=True)
        if "name" in data and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Only admins can change device names")
        await gree_manager.update_device(ip, data)
        
        states = await gree_manager.get_all_states()
        await manager.broadcast(json.dumps(states))
        
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/devices/{ip}/power")
async def set_power(ip: str, request: PowerRequest, current_user: User = Depends(get_current_user)):
    try:
        await gree_manager.set_power(ip, request.power)
        
        states = await gree_manager.get_all_states()
        await manager.broadcast(json.dumps(states))
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/devices/{ip}/temperature")
async def set_temperature(ip: str, request: TemperatureRequest, current_user: User = Depends(get_current_user)):
    try:
        await gree_manager.set_temperature(ip, request.temperature)
        
        states = await gree_manager.get_all_states()
        await manager.broadcast(json.dumps(states))
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/devices/{ip}/fan")
async def set_fan_speed(ip: str, request: FanSpeedRequest, current_user: User = Depends(get_current_user)):
    try:
        await gree_manager.set_fan_speed(ip, request.fan_speed)
        
        states = await gree_manager.get_all_states()
        await manager.broadcast(json.dumps(states))
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
