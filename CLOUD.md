# Cloud Access & Security Setup

To securely access your Gree AC Controller from anywhere without opening ports on your router, follow these steps using Cloudflare Tunnels.

## 1. Install Cloudflared
On your Linux server (Raspberry Pi/Home Server), install the Cloudflare Tunnel agent:

```bash
# Example for Debian/Ubuntu
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

## 2. Authenticate
```bash
cloudflared tunnel login
```
Follow the link provided to authorize your Cloudflare account.

## 3. Create a Tunnel
```bash
cloudflared tunnel create gree-ac-tunnel
```
This will create a tunnel and a credentials file.

## 4. Configure the Tunnel
Create or edit `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: ac.yourdomain.com
    service: http://localhost:8000
  - service: http_status:404
```

## 5. Route Traffic
```bash
cloudflared tunnel route dns gree-ac-tunnel ac.yourdomain.com
```

## 6. Run the Tunnel
```bash
cloudflared tunnel run gree-ac-tunnel
```

## 7. Security (Optional but Recommended)
Go to the **Cloudflare Zero Trust** dashboard:
1. Navigate to **Access** -> **Applications**.
2. Add a new **Self-hosted** application.
3. Set the domain to `ac.yourdomain.com`.
4. Configure a policy to allow only your email address (via One-Time PIN) or your Google/GitHub SSO account.

This ensures that only you can control your AC units, even if the URL is public.
