# Frosty ❄️

> ⚠️ **Disclaimer:** This app is "vibe coded" and should be used with caution.

A modern, responsive web controller for Gree Air Conditioning units.

Frosty gives you a beautiful dashboard to control all your Gree AC units from any device. It features real-time state synchronization, a sleek grid UI, Dark Mode, and Progressive Web App (PWA) support.

## Features
- 🚀 **Real-time Sync**: Instant updates across all your devices using WebSockets.
- 📱 **Mobile-First PWA**: Install it on your iOS or Android home screen like a native app. *(Note: Android requires the app to be served over a secure **HTTPS** connection, such as via a Cloudflare Tunnel, for installation to succeed).*
- 🎨 **Modern Dashboard**: Clean, responsive grid UI with dynamic mode icons.
- 🔒 **Secure Multi-User**: Built-in authentication with Admin and User roles.
- 💾 **Persistent Naming**: Give your units custom names (e.g., "Living Room") that survive DHCP IP changes.

---

## 🐳 Quick Start (Docker)

The absolute easiest way to run Frosty is via Docker. 

Because the Gree protocol uses UDP broadcasts to discover units, the container requires `network_mode: "host"`.

### Using Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  frosty:
    image: gutolm/frosty:latest
    container_name: frosty
    network_mode: "host"
    restart: unless-stopped
    volumes:
      - frosty_data:/app/data
    # environment:
      # Optional: Explicitly define IPs if UDP broadcast isn't working
      # - GREE_IPS=192.168.1.100,192.168.1.101

volumes:
  frosty_data:
```

Run it:
```bash
docker compose up -d
```

Access the UI at: **http://YOUR_SERVER_IP:8000**
* Default Login: `admin` / `admin` *(Please change this immediately!)*

---

## 🛠️ Manual Installation (Without Docker)

If you prefer to run it directly on bare metal (e.g., a Raspberry Pi):

1. **Clone the repo:**
   ```bash
   git clone https://github.com/yourusername/frosty.git
   cd frosty
   ```

2. **Run the startup script:**
   The included `run.sh` script will automatically build the React frontend and start the Python backend.
   ```bash
   chmod +x run.sh
   ./run.sh
   ```

## ☁️ Remote Access
Frosty is designed to be hosted locally. If you want to access it from outside your home securely without opening ports, we recommend using Cloudflare Tunnels. See [CLOUD.md](CLOUD.md) for a step-by-step guide.

---

## 📜 Credits & Third-Party Attribution

Frosty is built on top of excellent open-source libraries and APIs:

*   **Gree Device Communication:** Powered by the fantastic [greeclimate](https://github.com/cmroche/greeclimate) library by **cmroche**, which handles the heavy lifting of cryptographic handshakes and Gree local UDP protocols.
*   **Web Framework:** [FastAPI](https://fastapi.tiangolo.com/) by **Sebastián Ramírez** and [Uvicorn](https://www.uvicorn.org/) for the high-performance asynchronous API & WebSocket engine.
*   **Frontend Core:** Built with [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), and compiled using [Vite](https://vite.dev/).
*   **Aesthetics & UI:** Styled using [Tailwind CSS](https://tailwindcss.com/) with beautifully crafted icons from [Lucide React](https://lucide.dev/).
*   **Weather Integration:** Real-time weather widget data is powered by the free and open-source [Open-Meteo API](https://open-meteo.com/).

Thank you to all the open-source maintainers who made this project possible!