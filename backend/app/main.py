from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, status, WebSocket, WebSocketDisconnect, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
import json
import asyncio
import os
from datetime import timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .gree_manager import gree_manager
from .auth import (
    authenticate_user, 
    create_access_token, 
    get_current_user,
    get_active_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_user,
    update_user_db,
    delete_user_db
)
from .schemas import (
    Token,
    User,
    UserCreate,
    UserUpdate,
    DeviceState,
    DeviceUpdate,
    DeviceSaveRequest,
    DiscoveredDevice,
    PowerRequest,
    TemperatureRequest,
    FanSpeedRequest
)
from .rate_limiter import rate_limit
from .database import init_db, get_db

# Initialize database
init_db()

docs_enabled = os.getenv("ENABLE_DOCS", "false").lower() == "true"

app = FastAPI(
    title="Gree AC Controller API",
    docs_url="/docs" if docs_enabled else None,
    redoc_url="/redoc" if docs_enabled else None,
    openapi_url="/openapi.json" if docs_enabled else None,
)

# HTTP Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self)"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    
    # Prevent caching of API responses
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.open-meteo.com ws: wss:; "
        "font-src 'self' data:; "
        "frame-ancestors 'none';"
    )
    return response

# CORS Configuration
allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

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
        await asyncio.sleep(5) # Broadcast every 5 seconds

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
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Token missing")
        return
        
    try:
        user = get_current_user(token=token, db=db)
        if user.requires_password_change:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Password change required")
            return
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return

    if await manager.connect(websocket):
        try:
            await asyncio.sleep(0.2)
            states = await gree_manager.get_all_states()
            await websocket.send_text(json.dumps(states))
            
            while True:
                await websocket.receive_text()
        except (WebSocketDisconnect, Exception) as e:
            print(f"WS Exception: {repr(e)}")
            manager.disconnect(websocket)

@app.on_event("startup")
async def startup_event():
    async def run_initial_discovery():
        await gree_manager.discover_devices()
        try:
            states = await gree_manager.get_all_states()
            await manager.broadcast(json.dumps(states))
        except Exception:
            pass

    asyncio.create_task(run_initial_discovery())
    asyncio.create_task(state_broadcaster())
    asyncio.create_task(background_discovery())

@app.post("/api/token", response_model=Token, dependencies=[Depends(rate_limit(max_requests=5, window_seconds=30))])
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
async def list_users(current_user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    from .database import DBUser
    users = db.query(DBUser).all()
    return [User(username=u.username, is_admin=u.is_admin) for u in users]

@app.post("/api/users", response_model=User)
async def api_create_user(user: UserCreate, current_user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        return create_user(db, user.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/api/users/{username}", response_model=User, dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))])
async def api_update_user(username: str, updates: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Users can update themselves (e.g. changing their default password), or admins can update anyone
    if not current_user.is_admin and current_user.username != username:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    try:
        updated = update_user_db(db, username, updates.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return updated

@app.delete("/api/users/{username}")
async def api_delete_user(username: str, current_user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user.username == username:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    if not delete_user_db(db, username):
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success"}

@app.get("/api/devices", response_model=List[DeviceState])
async def get_devices(current_user: User = Depends(get_active_user)):
    return await gree_manager.get_all_states()

@app.post("/api/devices", response_model=DeviceState)
async def save_device(request: DeviceSaveRequest, current_user: User = Depends(get_active_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    await gree_manager.add_saved_device(request.mac, request.name)
    state = await gree_manager.get_device_state(request.mac)
    if not state:
        raise HTTPException(status_code=500, detail="Failed to retrieve device state after saving")
    return state

@app.delete("/api/devices/{mac}")
async def delete_device(mac: str, current_user: User = Depends(get_active_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    await gree_manager.remove_saved_device(mac)
    return {"status": "success"}

@app.get("/api/discover", response_model=List[DiscoveredDevice], dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))])
async def discover_new_devices(current_user: User = Depends(get_active_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    return await gree_manager.scan_for_new_devices()

@app.patch("/api/devices/{mac}")
async def update_device(mac: str, updates: DeviceUpdate, current_user: User = Depends(get_active_user)):
    data = updates.model_dump(exclude_unset=True)
    await gree_manager.update_device(mac, data)
    
    # Broadcast updated states
    states = await gree_manager.get_all_states()
    await manager.broadcast(json.dumps(states))
    
    return await gree_manager.get_device_state(mac)

@app.post("/api/devices/{mac}/power")
async def set_power(mac: str, request: PowerRequest, current_user: User = Depends(get_active_user)):
    await gree_manager.update_device(mac, {"power": request.power})
    states = await gree_manager.get_all_states()
    await manager.broadcast(json.dumps(states))
    return await gree_manager.get_device_state(mac)

@app.post("/api/devices/{mac}/temperature")
async def set_temperature(mac: str, request: TemperatureRequest, current_user: User = Depends(get_active_user)):
    await gree_manager.update_device(mac, {"target_temperature": request.temperature})
    states = await gree_manager.get_all_states()
    await manager.broadcast(json.dumps(states))
    return await gree_manager.get_device_state(mac)

@app.post("/api/devices/{mac}/fan_speed")
async def set_fan_speed(mac: str, request: FanSpeedRequest, current_user: User = Depends(get_active_user)):
    await gree_manager.update_device(mac, {"fan_speed": request.fan_speed})
    states = await gree_manager.get_all_states()
    await manager.broadcast(json.dumps(states))
    return await gree_manager.get_device_state(mac)

# Frontend static files serving
frontend_path = os.path.normpath(os.path.join(os.getcwd(), "frontend", "dist"))
if os.path.exists(frontend_path):
    assets_path = os.path.join(frontend_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/{fallback:path}")
    async def read_index(fallback: str):
        if fallback.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        
        # Path traversal defense
        safe_path = os.path.normpath(os.path.join(frontend_path, fallback))
        if os.path.commonpath([frontend_path, safe_path]) != frontend_path:
            raise HTTPException(status_code=403, detail="Forbidden")
            
        if fallback and os.path.exists(safe_path) and os.path.isfile(safe_path):
            return FileResponse(safe_path)
            
        return FileResponse(os.path.join(frontend_path, "index.html"))
else:
    print(f"Frontend dist path not found: {frontend_path}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
