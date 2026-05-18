import sys

path = './backend/app/main.py'
with open(path, 'r') as f:
    content = f.read()

content = content.replace(
    'from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, status',
    'from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, status, WebSocket, WebSocketDisconnect\nimport json\nimport asyncio'
)

cm_code = """
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
"""

content = content.replace('app = FastAPI(title="Gree AC Controller API")', 'app = FastAPI(title="Gree AC Controller API")\n' + cm_code)

startup_code = """@app.on_event("startup")
async def startup_event():
    import asyncio
    asyncio.create_task(gree_manager.discover_devices())
    asyncio.create_task(state_broadcaster())"""

import re
content = re.sub(r'@app\.on_event\("startup"\)[\s\S]*?asyncio\.create_task\(gree_manager\.discover_devices\(\)\)', startup_code, content)

broadcast_call = '\n        states = await gree_manager.get_all_states()\n        await manager.broadcast(json.dumps(states))'

content = content.replace('await gree_manager.update_device(ip, data)', 'await gree_manager.update_device(ip, data)' + broadcast_call)
content = content.replace('await gree_manager.set_power(ip, request.power)', 'await gree_manager.set_power(ip, request.power)' + broadcast_call)
content = content.replace('await gree_manager.set_temperature(ip, request.temperature)', 'await gree_manager.set_temperature(ip, request.temperature)' + broadcast_call)
content = content.replace('await gree_manager.set_fan_speed(ip, request.fan_speed)', 'await gree_manager.set_fan_speed(ip, request.fan_speed)' + broadcast_call)

with open(path, 'w') as f:
    f.write(content)
