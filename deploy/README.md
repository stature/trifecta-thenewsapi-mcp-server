# Deploying the HTTP MCP server on an Oracle Cloud "Always Free" VM + Caddy

End result: `https://your-domain/mcp` — a TLS-terminated, always-on Streamable HTTP MCP
endpoint you can paste into SecureAI / HatzAI, running for $0 on Oracle's Always Free
tier with Caddy handling certificates.

Files in this folder:

| File | Goes to | Purpose |
| --- | --- | --- |
| `Caddyfile` | `/etc/caddy/Caddyfile` | Reverse proxy + automatic HTTPS |
| `thenewsapi-mcp.service` | `/etc/systemd/system/thenewsapi-mcp.service` | Run the Node server as a managed service |
| `env.production.example` | `/opt/thenewsapi-mcp/.env` | Server config / secrets |

---

## 0. Prerequisites

- An Oracle Cloud account (free): <https://www.oracle.com/cloud/free/>
- A domain name you control (any registrar). If you don't have one, see
  [Appendix A: free hostname with DuckDNS](#appendix-a-free-hostname-with-duckdns).
- Your TheNewsAPI token.

---

## 1. Create the VM

Oracle Cloud Console → **Compute → Instances → Create instance**:

1. **Name:** `thenewsapi-mcp`
2. **Image:** Canonical **Ubuntu 22.04**
3. **Shape:** *Change shape* → **Ampere** → **VM.Standard.A1.Flex** →
   1 OCPU, 6 GB RAM (well within the Always Free allowance of 4 OCPU / 24 GB).
   - If Ampere capacity is unavailable in your region, use **VM.Standard.E2.1.Micro**
     (AMD, also Always Free).
4. **Networking:** keep the default VCN/subnet; **Assign a public IPv4 address = Yes**.
5. **SSH keys:** upload your public key (or let it generate one and download it).
6. **Create.** Wait for it to reach *Running*, note the **Public IP address**.

### Reserve the IP (so it survives reboots)

Instance page → **Attached VNICs** → click the VNIC → **IPv4 Addresses** → edit the
primary → **Public IP: Reserved** → assign a new reserved IP. Ephemeral IPs can change
if the instance is stopped; a reserved one won't.

---

## 2. Open ports 80 and 443

Oracle has **two** firewalls. You must open both.

### 2a. Cloud side — VCN Security List

Console → **Networking → Virtual Cloud Networks** → your VCN → **Security Lists** →
*Default Security List* → **Add Ingress Rules**, add two:

| Stateless | Source CIDR | IP Protocol | Destination Port |
| --- | --- | --- | --- |
| No | `0.0.0.0/0` | TCP | `80` |
| No | `0.0.0.0/0` | TCP | `443` |

(SSH `22` is already there.)

### 2b. Instance side — iptables

SSH in first:

```bash
ssh ubuntu@<your-public-ip>
```

Then:

```bash
sudo iptables -I INPUT -p tcp --dport 80  -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## 3. Install Node.js 20 and Caddy

Still on the VM:

```bash
# Node.js 20 LTS (system-wide, so systemd can find /usr/bin/node)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Caddy (official apt repo)
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy

node --version   # expect v20.x
```

---

## 4. Point your domain at the VM

At your DNS provider, create an **A record**:

```
mcp.example.com   ->   <your reserved public IP>
```

Verify it has propagated before continuing:

```bash
dig +short mcp.example.com     # should print your IP
```

---

## 5. Install the MCP server

```bash
# Dedicated unprivileged user, no login shell
sudo useradd --system --home /opt/thenewsapi-mcp --shell /usr/sbin/nologin mcp

# Get the code
sudo git clone https://github.com/stature/trifecta-thenewsapi-mcp-server.git /opt/thenewsapi-mcp
cd /opt/thenewsapi-mcp

# Build
sudo npm ci
sudo npm run build

# Config
sudo cp deploy/env.production.example .env
sudo nano .env         # set NEWS_API_TOKEN and MCP_AUTH_TOKEN (see below)
```

Generate a strong `MCP_AUTH_TOKEN`:

```bash
openssl rand -hex 32
```

Paste that as the `MCP_AUTH_TOKEN` value in `.env`. Then lock the files down:

```bash
sudo chown -R mcp:mcp /opt/thenewsapi-mcp
sudo chmod 600 /opt/thenewsapi-mcp/.env
```

---

## 6. Start the service

```bash
sudo cp deploy/thenewsapi-mcp.service /etc/systemd/system/thenewsapi-mcp.service
sudo systemctl daemon-reload
sudo systemctl enable --now thenewsapi-mcp

sudo systemctl status thenewsapi-mcp --no-pager
```

You want `active (running)`. Quick local check (still on the VM):

```bash
curl -s http://127.0.0.1:3000/healthz
# {"ok":true,"server":"thenewsapi-mcp","transport":"streamable-http"}
```

Logs, if needed:

```bash
sudo journalctl -u thenewsapi-mcp -f
```

---

## 7. Configure Caddy

```bash
sudo cp /opt/thenewsapi-mcp/deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/mcp\.example\.com/mcp.yourdomain.com/' /etc/caddy/Caddyfile
sudo mkdir -p /var/log/caddy && sudo chown caddy:caddy /var/log/caddy

sudo systemctl restart caddy
sudo systemctl status caddy --no-pager
```

Caddy will fetch a Let's Encrypt certificate on first request (watch
`sudo journalctl -u caddy -f`). Give it ~15 seconds, then from your **laptop**:

```bash
curl -s https://mcp.yourdomain.com/healthz
```

HTTPS + the health JSON = done.

---

## 8. Verify the full MCP handshake

From your laptop, replace the host and token:

```bash
curl -sD- https://mcp.yourdomain.com/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'authorization: Bearer <your MCP_AUTH_TOKEN>' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

Expect `HTTP/2 200`, an `mcp-session-id:` response header, and a JSON body listing the
server capabilities. Omit the `authorization` header and you should get `401`.

---

## 9. Add it to SecureAI / HatzAI

| Field | Value |
| --- | --- |
| Server URL | `https://mcp.yourdomain.com/mcp` |
| Transport | Streamable HTTP |
| Authentication Method | **Bearer Token** → your `MCP_AUTH_TOKEN` |
| | (or **API Key** → same value, header `X-API-Key`) |

---

## Updating later

```bash
cd /opt/thenewsapi-mcp
sudo -u mcp git pull
sudo -u mcp npm ci
sudo -u mcp npm run build
sudo systemctl restart thenewsapi-mcp
```

## Operations cheatsheet

| Task | Command |
| --- | --- |
| Restart app | `sudo systemctl restart thenewsapi-mcp` |
| App logs | `sudo journalctl -u thenewsapi-mcp -f` |
| Reload Caddy after Caddyfile edit | `sudo systemctl reload caddy` |
| Caddy logs | `sudo journalctl -u caddy -f` |
| Rotate the client secret | edit `.env`, `sudo systemctl restart thenewsapi-mcp`, update SecureAI |
| Check cert | `curl -sI https://mcp.yourdomain.com/healthz` |

## Hardening notes

- The app binds `127.0.0.1` only — it is unreachable except through Caddy.
- `MCP_AUTH_TOKEN` is required in production; without it the endpoint is open to anyone
  who finds the URL.
- Keep the VM patched: `sudo apt-get update && sudo apt-get upgrade -y` (consider
  `unattended-upgrades`).
- Optionally restrict the VCN ingress rules for 443 to SecureAI's egress IP range if
  they publish one.
- `NEWS_API_TOKEN` never leaves the server; clients only ever hold `MCP_AUTH_TOKEN`.

---

## Appendix A: free hostname with DuckDNS

If you don't want to buy a domain:

1. Sign in at <https://www.duckdns.org> (GitHub/Google), create a subdomain, e.g.
   `yourname-mcp` → gives `yourname-mcp.duckdns.org`.
2. Set its IP to your VM's reserved public IP (on the DuckDNS page, or via their update
   URL).
3. Use `yourname-mcp.duckdns.org` everywhere this guide says `mcp.yourdomain.com`.

Caddy's default HTTP challenge works with DuckDNS as long as ports 80/443 are open
(steps 2a/2b), so no extra config is needed.

## Appendix B: keep-alive / uptime

The service has `Restart=on-failure`, and `systemctl enable` makes it start on boot, so
it survives crashes and reboots. For external visibility, point a free uptime monitor
(e.g. UptimeRobot) at `https://mcp.yourdomain.com/healthz`.
