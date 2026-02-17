# Terminal Setup Guide — Replication Playbook

How to replicate the UMT-HUD web terminal infrastructure on a new Linux dev box. This covers every layer: tmux, ttyd, the tmux-api Node.js server, Tailscale networking, systemd services, and UMT-HUD frontend integration.

---

## Architecture Overview

```
Browser (cloudops.umetech.net)
  │  Azure AD authenticated
  │
  ├─► AdminTerminal.tsx ──fetch──► /api/tmux-api ──proxy──► Tailscale ──► :8080/api/tmux-sessions
  │   (session dashboard)          (Azure Function)                        (Node.js tmux-api)
  │
  └─► TerminalWindow.tsx ──iframe──► Tailscale ──► :7681 (ttyd)
      (full terminal)                               └─► tmux attach -t <session>
```

**Three security layers:**
1. **Azure AD EasyAuth** — gate on cloudops.umetech.net
2. **Tailscale VPN** — terminal server only reachable on private tailnet
3. **Duo MFA** (optional) — server-side push authentication on the host

---

## Prerequisites

| Requirement | Purpose |
|-------------|---------|
| Linux server (Ubuntu/Debian) | Terminal host |
| Node.js 18+ | tmux-api server |
| tmux | Session management |
| ttyd | Web terminal (browser shell) |
| Tailscale | Private network access |
| systemd | Service management |

---

## Step 1: Install Dependencies

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install tmux
sudo apt-get install -y tmux

# Install Node.js 18+ (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install ttyd (web terminal)
sudo apt-get install -y ttyd
# If not in repos, build from source: https://github.com/tsl0922/ttyd

# Install git (for branch detection in tmux-api)
sudo apt-get install -y git
```

---

## Step 2: Install & Configure Tailscale

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Start and authenticate
sudo systemctl enable tailscaled
sudo systemctl start tailscaled
sudo tailscale up

# Verify
tailscale status
```

Note your machine's Tailscale hostname (e.g., `newbox.tail68ddf4.ts.net`). You'll need this for the frontend config later.

---

## Step 3: Create the tmux-api Server

This is the Node.js API that reports session status, CPU/memory per session, server stats, and provides session management endpoints.

### 3a. Create the directory

```bash
sudo mkdir -p /opt/tmux-api
sudo chown $USER:$USER /opt/tmux-api
```

### 3b. Write the server code

Create `/opt/tmux-api/server.js`:

```javascript
const http = require('http');
const { execSync, exec } = require('child_process');
const os = require('os');
const url = require('url');

const PORT = 8080;

// ============== UTILITY FUNCTIONS ==============

function getCpu() {
  try {
    const s1 = execSync('cat /proc/stat | head -1', {encoding:'utf8'}).split(/\s+/).slice(1,8).map(Number);
    execSync('sleep 0.1');
    const s2 = execSync('cat /proc/stat | head -1', {encoding:'utf8'}).split(/\s+/).slice(1,8).map(Number);
    return Math.round((1-(s2[3]-s1[3])/(s2.reduce((a,b)=>a+b)-s1.reduce((a,b)=>a+b)))*1000)/10;
  } catch { return null; }
}

function getMem() {
  try {
    const m = execSync('cat /proc/meminfo', {encoding:'utf8'});
    const g = k => parseInt(m.match(new RegExp(k+':\\s+(\\d+)'))?.[1]||0)/1024;
    return {total:Math.round(g('MemTotal')),used:Math.round(g('MemTotal')-g('MemAvailable')),available:Math.round(g('MemAvailable'))};
  } catch { return null; }
}

function getDisk() {
  try {
    const p = execSync('df -BM / | tail -1', {encoding:'utf8'}).split(/\s+/);
    return {total:parseInt(p[1]),used:parseInt(p[2]),percent:parseInt(p[4])};
  } catch { return null; }
}

function getProcStats(pids) {
  if (!pids.length) return {cpu:0,memory:0};
  try {
    let cpu=0,mem=0;
    execSync(`ps -o %cpu,%mem --no-headers -p ${pids.join(',')} 2>/dev/null||true`,{encoding:'utf8'}).trim().split('\n').forEach(l=>{const p=l.trim().split(/\s+/);cpu+=parseFloat(p[0])||0;mem+=parseFloat(p[1])||0;});
    execSync(`ps -o %cpu,%mem --no-headers --ppid ${pids.join(',')} 2>/dev/null||true`,{encoding:'utf8'}).trim().split('\n').forEach(l=>{const p=l.trim().split(/\s+/);cpu+=parseFloat(p[0])||0;mem+=parseFloat(p[1])||0;});
    return {cpu:Math.round(cpu*10)/10,memory:Math.round(mem*10)/10};
  } catch { return {cpu:0,memory:0}; }
}

function getSessions() {
  try {
    const raw = execSync('tmux list-sessions -F "#{session_name}|#{session_created}|#{session_windows}|#{session_attached}|#{session_activity}" 2>/dev/null||echo ""',{encoding:'utf8'}).trim();
    if (!raw) return [];
    return raw.split('\n').map(line => {
      const [name,created,windows,attached,activity] = line.split('|');
      let panes=0,pids=[],commands=[],gitBranch=null;
      try {
        const pr = execSync(`tmux list-panes -t "${name}" -F "#{pane_pid}|#{pane_current_command}" 2>/dev/null`,{encoding:'utf8'}).trim();
        pr.split('\n').forEach(p=>{const [pid,cmd]=p.split('|');pids.push(pid);if(cmd&&!commands.includes(cmd))commands.push(cmd);});
        panes = pr.split('\n').length;
        const cwd = execSync(`readlink -f /proc/${pids[0]}/cwd 2>/dev/null||echo""`,{encoding:'utf8'}).trim();
        if (cwd) gitBranch = execSync(`git -C "${cwd}" rev-parse --abbrev-ref HEAD 2>/dev/null||echo""`,{encoding:'utf8'}).trim()||null;
      } catch {}
      const stats = getProcStats(pids);
      return {name,created:+created,windows:+windows,panes,attached:+attached,lastActivity:+activity,cpu:stats.cpu,memory:stats.memory,commands:commands.slice(0,3),gitBranch};
    });
  } catch { return []; }
}

// ============== SESSION MANAGEMENT ==============

function killSession(sessionName) {
  try {
    execSync(`tmux kill-session -t "${sessionName}" 2>/dev/null`);
    return { success: true, message: `Session '${sessionName}' killed` };
  } catch (err) {
    return { success: false, error: `Failed to kill session: ${err.message}` };
  }
}

function getSessionPreview(sessionName, lines = 50) {
  try {
    const output = execSync(
      `tmux capture-pane -t "${sessionName}" -p -S -${lines} 2>/dev/null`,
      { encoding: 'utf8', maxBuffer: 1024 * 1024 }
    );
    return { success: true, lines: output.split('\n').slice(-lines), sessionName };
  } catch (err) {
    return { success: false, error: `Failed to get preview: ${err.message}` };
  }
}

function runCommand(sessionName, command) {
  try {
    execSync(`tmux send-keys -t "${sessionName}" "${command}" Enter 2>/dev/null`);
    return { success: true, message: `Command sent to '${sessionName}'` };
  } catch (err) {
    return { success: false, error: `Failed to run command: ${err.message}` };
  }
}

function createSession(sessionName, startupCommand = null, workingDir = null) {
  try {
    const exists = execSync(`tmux has-session -t "${sessionName}" 2>/dev/null && echo "yes" || echo "no"`, {encoding:'utf8'}).trim();
    if (exists === 'yes') {
      return { success: false, error: `Session '${sessionName}' already exists` };
    }
    let cmd = `tmux new-session -d -s "${sessionName}"`;
    if (workingDir) cmd += ` -c "${workingDir}"`;
    execSync(cmd);
    if (startupCommand) {
      execSync(`tmux send-keys -t "${sessionName}" "${startupCommand}" Enter`);
    }
    return { success: true, message: `Session '${sessionName}' created` };
  } catch (err) {
    return { success: false, error: `Failed to create session: ${err.message}` };
  }
}

// Session templates
const SESSION_TEMPLATES = {
  'node-dev': {
    name: 'Node.js Development',
    commands: ['npm install', 'npm run dev'],
    description: 'Install deps and start dev server'
  },
  'git-pull': {
    name: 'Git Update',
    commands: ['git fetch --all', 'git pull'],
    description: 'Fetch and pull latest changes'
  },
  'logs-tail': {
    name: 'Tail Logs',
    commands: ['tail -f /var/log/syslog'],
    description: 'Watch system logs'
  },
  'docker-logs': {
    name: 'Docker Logs',
    commands: ['docker ps', 'docker logs -f $(docker ps -q | head -1)'],
    description: 'List containers and tail first one'
  }
};

function getTemplates() {
  return { success: true, templates: SESSION_TEMPLATES };
}

function applyTemplate(sessionName, templateId) {
  const template = SESSION_TEMPLATES[templateId];
  if (!template) return { success: false, error: `Template '${templateId}' not found` };
  try {
    template.commands.forEach((cmd, i) => {
      setTimeout(() => {
        execSync(`tmux send-keys -t "${sessionName}" "${cmd}" Enter 2>/dev/null`);
      }, i * 500);
    });
    return { success: true, message: `Template '${template.name}' applied to '${sessionName}'` };
  } catch (err) {
    return { success: false, error: `Failed to apply template: ${err.message}` };
  }
}

// ============== HTTP SERVER ==============

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // GET /api/tmux-sessions - List all sessions with stats
  if (pathname === '/api/tmux-sessions' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      sessions: getSessions(),
      server: {
        hostname: os.hostname(),
        cpu: getCpu(),
        cpuCores: os.cpus().length,
        loadAvg: os.loadavg().map(l => Math.round(l*100)/100),
        memory: getMem(),
        disk: getDisk(),
        uptime: Math.floor(os.uptime())
      }
    }));
    return;
  }

  // DELETE /api/tmux-sessions/:name - Kill a session
  if (pathname.startsWith('/api/tmux-sessions/') && req.method === 'DELETE') {
    const sessionName = decodeURIComponent(pathname.split('/')[3]);
    const result = killSession(sessionName);
    res.writeHead(result.success ? 200 : 400, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(result));
    return;
  }

  // GET /api/tmux-sessions/:name/preview?lines=50 - Terminal preview
  if (pathname.match(/^\/api\/tmux-sessions\/[^/]+\/preview$/) && req.method === 'GET') {
    const sessionName = decodeURIComponent(pathname.split('/')[3]);
    const lines = parseInt(query.lines) || 50;
    const result = getSessionPreview(sessionName, lines);
    res.writeHead(result.success ? 200 : 400, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(result));
    return;
  }

  // POST /api/tmux-sessions/:name/command - Run command in session
  if (pathname.match(/^\/api\/tmux-sessions\/[^/]+\/command$/) && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { command } = JSON.parse(body);
        const sessionName = decodeURIComponent(pathname.split('/')[3]);
        const result = runCommand(sessionName, command);
        res.writeHead(result.success ? 200 : 400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // POST /api/tmux-sessions - Create new session
  if (pathname === '/api/tmux-sessions' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { name, command, workingDir } = JSON.parse(body);
        const result = createSession(name, command, workingDir);
        res.writeHead(result.success ? 201 : 400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // GET /api/templates - List available templates
  if (pathname === '/api/templates' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(getTemplates()));
    return;
  }

  // POST /api/tmux-sessions/:name/template - Apply template
  if (pathname.match(/^\/api\/tmux-sessions\/[^/]+\/template$/) && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { templateId } = JSON.parse(body);
        const sessionName = decodeURIComponent(pathname.split('/')[3]);
        const result = applyTemplate(sessionName, templateId);
        res.writeHead(result.success ? 200 : 400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // GET /api/health - Health check
  if (pathname === '/api/health' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return;
  }

  res.writeHead(404, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Tmux API (Phase 2) running on port ${PORT}`);
  console.log('Endpoints:');
  console.log('  GET    /api/tmux-sessions              - List sessions with stats');
  console.log('  DELETE /api/tmux-sessions/:name        - Kill session');
  console.log('  GET    /api/tmux-sessions/:name/preview?lines=50 - Terminal preview');
  console.log('  POST   /api/tmux-sessions/:name/command - Run command {command}');
  console.log('  POST   /api/tmux-sessions              - Create session {name, command?, workingDir?}');
  console.log('  GET    /api/templates                  - List templates');
  console.log('  POST   /api/tmux-sessions/:name/template - Apply template {templateId}');
});
```

---

## Step 4: Create systemd Services

### 4a. tmux-api service

Create `/etc/systemd/system/tmux-api.service`:

```ini
[Unit]
Description=Tmux API Server
After=network.target

[Service]
Type=simple
User=jgoode
ExecStart=/usr/bin/node /opt/tmux-api/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Important:** The `User=` must match the user who owns the tmux sessions. The API runs `tmux list-sessions` as this user, so it only sees that user's sessions.

```bash
sudo systemctl daemon-reload
sudo systemctl enable tmux-api
sudo systemctl start tmux-api
```

### 4b. ttyd service

Create `/etc/systemd/system/ttyd.service`:

```ini
[Unit]
Description=ttyd Web Terminal
After=network.target

[Service]
Type=simple
User=jgoode
ExecStart=/usr/bin/ttyd -p 7681 tmux attach -t
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

The `tmux attach -t` (with no session name) is intentional — the session name is passed via the `?arg=` URL parameter from the frontend. ttyd passes URL args as command arguments, so `/?arg=umthud` becomes `tmux attach -t umthud`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable ttyd
sudo systemctl start ttyd
```

### 4c. Verify both services

```bash
sudo systemctl status tmux-api
sudo systemctl status ttyd

# Test tmux-api locally
curl http://127.0.0.1:8080/api/tmux-sessions | jq

# Test ttyd locally (should return HTML)
curl -s http://127.0.0.1:7681/ | head -5
```

---

## Step 5: Configure Tailscale Serve

Tailscale serve exposes local ports as HTTPS on your tailnet hostname — no nginx, no certs to manage.

```bash
# Expose ttyd (web terminal) at the root path
tailscale serve --bg --set-path / http://127.0.0.1:7681

# Expose tmux-api at /tmux-api
tailscale serve --bg --set-path /tmux-api http://127.0.0.1:8080/api/tmux-sessions
```

**Result:**
| URL | Routes to | Purpose |
|-----|-----------|---------|
| `https://<hostname>.tail68ddf4.ts.net/` | `http://127.0.0.1:7681` | ttyd web terminal |
| `https://<hostname>.tail68ddf4.ts.net/tmux-api` | `http://127.0.0.1:8080/api/tmux-sessions` | Session status API |
| `https://<hostname>.tail68ddf4.ts.net/?arg=umthud` | ttyd → `tmux attach -t umthud` | Attach to specific session |

Verify:

```bash
tailscale serve status

# From another machine on the tailnet:
curl https://<hostname>.tail68ddf4.ts.net/tmux-api | jq
```

---

## Step 6: Create Your tmux Sessions

Create the default sessions that the dashboard expects:

```bash
# Project sessions (match the tmuxName values in the frontend)
tmux new-session -d -s umthud
tmux new-session -d -s serverhealth
tmux new-session -d -s itglue
tmux new-session -d -s screenconnectsec
tmux new-session -d -s securescan
tmux new-session -d -s autotaskreports
tmux new-session -d -s umtpax8
tmux new-session -d -s clientstack
tmux new-session -d -s zoneshift
tmux new-session -d -s sightline
tmux new-session -d -s oversitev1
```

These names correspond to the `DEFAULT_TERMINAL_SESSIONS` array in `frontend/src/services/userPreferences.ts`:

| Display Name | tmux Session Name |
|-------------|-------------------|
| UMT HUD | `umthud` |
| Server Health | `serverhealth` |
| ITGlue Monitor | `itglue` |
| ScreenConnect Sec | `screenconnectsec` |
| SecureScan | `securescan` |
| AutoTask Reports | `autotaskreports` |
| UMT Pax8 | `umtpax8` |
| ClientStack | `clientstack` |
| ZoneShift | `zoneshift` |
| Sightline | `sightline` |
| OversiteV1 | `oversitev1` |

Users can also create custom sessions from the dashboard UI. Custom sessions are stored server-side in Azure Table Storage (never localStorage).

---

## Step 7: Update UMT-HUD Frontend

Replace the old hostname with your new server's Tailscale hostname in these files:

### `frontend/src/pages/AdminTerminal.tsx`

```typescript
// ~line 119 — update to new hostname
const TERMINAL_SERVER = 'https://<NEW-HOSTNAME>.tail68ddf4.ts.net';
```

The status API URL is constructed from this:
```typescript
const STATUS_API = `${TERMINAL_SERVER}/tmux-api`;
```

### `frontend/src/pages/TerminalWindow.tsx`

```typescript
// line 8
const terminalUrl = 'https://<NEW-HOSTNAME>.tail68ddf4.ts.net';
```

The iframe URL becomes:
```
https://<NEW-HOSTNAME>.tail68ddf4.ts.net/?arg=<tmux-session-name>
```

---

## Step 8: Update the Azure Function Proxy

### `api/proxyTmuxSessions/index.ts`

```typescript
// line 8 — update to new hostname
const TMUX_API = 'https://<NEW-HOSTNAME>.tail68ddf4.ts.net/api/tmux-sessions';
```

This proxy is called by the frontend at `/api/tmux-api` and forwards to the dev server. It has a 5-second timeout and returns `504` on timeout, `500` on connection failure.

**Don't forget:** The function path must be in `api/tsconfig.json`'s `include` array:
```json
"include": [
  // ...
  "proxyTmuxSessions/index.ts"
]
```

The function binding is in `api/proxyTmuxSessions/function.json`:
```json
{
  "bindings": [{
    "authLevel": "anonymous",
    "type": "httpTrigger",
    "direction": "in",
    "name": "req",
    "methods": ["get"],
    "route": "tmux-api"
  }, {
    "type": "http",
    "direction": "out",
    "name": "res"
  }]
}
```

---

## Step 9: Update Content Security Policy

In `staticwebapp.config.json`, the CSP must allow your new tailnet domain in both `connect-src` and `frame-src`:

```
connect-src ... https://*.tail68ddf4.ts.net;
frame-src ... https://*.tail68ddf4.ts.net;
```

If your new server is on a **different** tailnet, update the wildcard accordingly. Use the specific tailnet domain (e.g., `*.tail68ddf4.ts.net`), NOT `*.ts.net` — restricting to your tailnet prevents other Tailscale users from being CSP-allowed.

---

## Step 10: Verify End-to-End

### On the new server

```bash
# tmux-api health check
curl http://127.0.0.1:8080/api/health
# Expected: {"status":"ok","timestamp":...}

# tmux-api session list
curl http://127.0.0.1:8080/api/tmux-sessions | jq
# Expected: {"sessions":[...],"server":{"hostname":"...","cpu":...}}

# ttyd is running
curl -s http://127.0.0.1:7681/ | head -1
# Expected: HTML content

# Tailscale serve is routing
tailscale serve status

# From another tailnet machine
curl https://<NEW-HOSTNAME>.tail68ddf4.ts.net/tmux-api | jq
```

### From the browser

1. Connect to Tailscale VPN
2. Navigate to `https://cloudops.umetech.net`
3. Log in via Azure AD
4. Go to Admin > Terminal Sessions
5. Session table should populate with live data
6. Click a session — should open ttyd in a new window

---

## API Reference

### tmux-api Endpoints (port 8080)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `GET` | `/api/tmux-sessions` | — | List all sessions with CPU/memory/server stats |
| `DELETE` | `/api/tmux-sessions/:name` | — | Kill a session |
| `GET` | `/api/tmux-sessions/:name/preview?lines=N` | — | Capture last N lines of pane output |
| `POST` | `/api/tmux-sessions/:name/command` | `{"command":"..."}` | Send keys to a session |
| `POST` | `/api/tmux-sessions` | `{"name":"...","command":"...","workingDir":"..."}` | Create new session |
| `GET` | `/api/templates` | — | List session templates |
| `POST` | `/api/tmux-sessions/:name/template` | `{"templateId":"..."}` | Apply template to session |
| `GET` | `/api/health` | — | Health check |

### Response Schemas

**Session object:**
```json
{
  "name": "umthud",
  "created": 1706572800,
  "windows": 3,
  "panes": 5,
  "attached": 1,
  "lastActivity": 1706573100,
  "cpu": 2.5,
  "memory": 1.2,
  "commands": ["vim", "node", "npm"],
  "gitBranch": "master"
}
```

**Server stats object:**
```json
{
  "hostname": "jmgdev",
  "cpu": 15.3,
  "cpuCores": 8,
  "loadAvg": [1.2, 1.5, 1.1],
  "memory": { "total": 16384, "used": 8192, "available": 8000 },
  "disk": { "total": 1000000, "used": 500000, "percent": 50 },
  "uptime": 86400
}
```

---

## Audit Logging

The AdminTerminal page logs these events to Azure Table Storage via `/api/admin/audit-log`:

| Action | Trigger |
|--------|---------|
| `terminal:open` | User clicks to open a session |
| `terminal:create` | User creates a custom session |
| `terminal:remove` | User removes a custom session |
| `terminal:edit` | User edits a session entry |
| `terminal:reset` | User resets to default sessions |

Each log entry records: action, details, userEmail, userName, ipAddress, timestamp.

Only the admin email (`jgoode@umetech.net`) can retrieve logs via `GET /api/admin/audit-log?limit=100`.

---

## Security Checklist

- [ ] **No public exposure** — ttyd and tmux-api bind to `127.0.0.1` only
- [ ] **No nginx proxy** — never create a public reverse proxy to the terminal (see [security incident](./2026-01-30-TERMINAL-SECURITY-FIX.md))
- [ ] **Tailscale serve only** — all external access goes through Tailscale's encrypted tunnel
- [ ] **CSP locked to tailnet** — use specific tailnet domain, not `*.ts.net`
- [ ] **Azure AD required** — dashboard pages require authentication
- [ ] **Admin-gated** — terminal management page restricted to admin email
- [ ] **Audit trail** — all terminal actions logged to Azure Table Storage

---

## Troubleshooting

### tmux-api returns empty sessions
The service must run as the same user who owns the tmux sessions. Check `User=` in the systemd unit.

### ttyd shows "session not found"
The tmux session must already exist. Create it first: `tmux new-session -d -s sessionname`

### Frontend can't reach terminal server
1. Check you're connected to Tailscale: `tailscale status`
2. Check Tailscale serve is active: `tailscale serve status`
3. Check CSP allows the tailnet domain in both `connect-src` and `frame-src`

### Iframe shows blank / connection refused
ttyd must be listening on the port Tailscale serve is forwarding to. Verify: `curl http://127.0.0.1:7681/`

### "Tmux API timeout" in the dashboard
The Azure Function proxy has a 5-second timeout. Check that the dev server is reachable from Azure (it goes through Tailscale, so the SWA won't have direct access — the proxy function runs server-side but needs network path to the tailnet). The proxy in `proxyTmuxSessions` calls the Tailscale URL directly, so the Azure Function host itself would need Tailscale access OR you need a different network path.

### Session CPU/memory shows 0
The `ps` command must be able to see processes from tmux panes. Verify the tmux-api user matches the tmux session owner.

---

## Files Reference

| File | Location | Purpose |
|------|----------|---------|
| `server.js` | `/opt/tmux-api/server.js` (on dev server) | tmux status API |
| `tmux-api.service` | `/etc/systemd/system/tmux-api.service` | systemd unit for API |
| `ttyd.service` | `/etc/systemd/system/ttyd.service` | systemd unit for web terminal |
| `AdminTerminal.tsx` | `frontend/src/pages/AdminTerminal.tsx` | Dashboard UI (815 lines) |
| `TerminalWindow.tsx` | `frontend/src/pages/TerminalWindow.tsx` | Iframe terminal wrapper |
| `proxyTmuxSessions/index.ts` | `api/proxyTmuxSessions/index.ts` | Azure Function proxy |
| `userPreferences.ts` | `frontend/src/services/userPreferences.ts` | Session storage + defaults |
| `adminAuditLog/index.ts` | `api/adminAuditLog/index.ts` | Audit log API |
| `staticwebapp.config.json` | Project root | CSP & routing rules |

---

## Current Production Values (jmgdev)

For reference, these are the values used in the current production setup:

| Setting | Value |
|---------|-------|
| Tailscale hostname | `jmgdev.tail68ddf4.ts.net` |
| Tailnet domain | `tail68ddf4.ts.net` |
| ttyd port | `7681` |
| tmux-api port | `8080` |
| tmux-api bind | `127.0.0.1` |
| ttyd internal IP | `100.87.52.113` (Tailscale IP) |
| Service user | `jgoode` |
| Admin email | `jgoode@umetech.net` |
| Dashboard URL | `https://cloudops.umetech.net` |
