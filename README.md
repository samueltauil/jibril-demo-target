# Jibril Demo Target

A containerized application that performs **intentionally suspicious system operations** to test the [Jibril Correlation Agent](https://github.com/samueltauil/jibril-correlation-agent)'s attack chain detection.

When run on a host with [Jibril](https://jibril.garnet.ai/) eBPF monitoring, the app's operations trigger real security detections that flow through the reaction pipeline into the correlation agent, exercising all 6 MITRE ATT&CK chain patterns end-to-end.

## Architecture

```
┌─ Host / VM ─────────────────────────────────────────────────┐
│                                                             │
│  ┌─ demo-target container ──┐   ┌─ Jibril (host eBPF) ───┐ │
│  │ Node.js app: 6 attack    │   │ Detects real syscalls   │ │
│  │ scenarios via HTTP POST  │──→│ from the container      │ │
│  └──────────────────────────┘   └──────────┬──────────────┘ │
│                                            │ shell reaction │
│                                            │ curl POST      │
│                                            ▼                │
│                              ┌─ Azure (remote) ───────────┐ │
│                              │ Correlation Agent          │ │
│                              │ • Ingests events at /events│ │
│                              │ • GitHub App installed on  │ │
│                              │   jibril-demo-target repo  │ │
│                              │ • Searches source code     │ │
│                              │ • Correlates & alerts      │ │
│                              └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **Docker** (for building and running the demo target)
- **Jibril** installed on the host ([jibril.garnet.ai](https://jibril.garnet.ai/))
- **Jibril Correlation Agent** running (locally or on Azure)
- **GitHub App** installed on this repo (so the agent can search the source code)

## Quick Start

### 1. Build the demo target

```bash
docker compose build
# or
docker build -t jibril-demo-target .
```

### 2. Install Jibril configuration

```bash
sudo ./jibril/setup.sh
```

This copies the config and private alchemies to `/etc/jibril/`.

### 3. Start Jibril with the agent URL

```bash
# Point to your Azure-hosted agent:
sudo AGENT_URL=https://your-agent.azurecontainerapps.io jibril

# Or for local testing:
sudo AGENT_URL=http://localhost:3000 jibril
```

### 4. Start the demo target

```bash
docker compose up -d
# or
docker run -d -p 8080:8080 jibril-demo-target
```

### 5. Trigger scenarios

```bash
# Run all 6 scenarios:
curl -X POST http://localhost:8080/scenario/all | jq .

# Or run individually:
curl -X POST http://localhost:8080/scenario/credential-theft | jq .
curl -X POST http://localhost:8080/scenario/execution-c2-exfil | jq .
curl -X POST http://localhost:8080/scenario/container-breakout | jq .
curl -X POST http://localhost:8080/scenario/cryptojacking | jq .
curl -X POST http://localhost:8080/scenario/supply-chain | jq .
curl -X POST http://localhost:8080/scenario/linker-hijack | jq .
```

### 6. Check detected chains

```bash
# On the correlation agent:
curl -s https://your-agent.azurecontainerapps.io/chains | jq .
curl -s https://your-agent.azurecontainerapps.io/health | jq .
```

Or use the convenience script:

```bash
AGENT_URL=https://your-agent.azurecontainerapps.io ./scripts/run-scenarios.sh
```

## Attack Scenarios

Each scenario triggers a specific MITRE ATT&CK attack chain pattern:

| # | Scenario | Chain Pattern | Tactics | Operations |
|---|----------|---------------|---------|------------|
| 1 | `credential-theft` | Credential Theft → Privesc → Persistence | credential_access → privilege_escalation → persistence | Read `/etc/shadow`, `sudo -l`, write `.bashrc` |
| 2 | `execution-c2-exfil` | Execution → C2 → Exfiltration | execution → command_and_control → exfiltration | Exec `/tmp/payload`, curl C2 domain, curl data out |
| 3 | `container-breakout` | Container Breakout | defense_evasion → credential_access → privilege_escalation | Exec from `/dev/shm`, read `/etc/shadow`, write sudoers |
| 4 | `cryptojacking` | Cryptojacking | impact → command_and_control | Exec `xmrig` binary, connect to mining pool |
| 5 | `supply-chain` | Supply Chain + Lateral | execution → defense_evasion → credential_access | Exec dropped binary, timestomp, read SSH keys |
| 6 | `linker-hijack` | Dynamic Linker Hijack | persistence → defense_evasion → execution | `LD_PRELOAD` .so, masquerade binary, exec from `/tmp` |

## How It Works

1. **You trigger a scenario** via HTTP POST to the demo target container
2. **The app performs real OS operations** — file reads, process spawning, network connections
3. **Jibril's eBPF sensors detect** the syscalls (they're genuinely suspicious from a runtime perspective)
4. **Jibril's shell reactions** forward the event JSON to the correlation agent's `/events` endpoint
5. **The correlation agent** groups events by container, matches them against chain patterns, and detects the attack chain
6. **The agent can search this repo** (via the installed GitHub App) to find the exact source code responsible

## Agent Configuration

Make sure the correlation agent knows about this repo. Set the `REPO_MAPPINGS` environment variable:

```
REPO_MAPPINGS=jibril-demo-target=samueltauil/jibril-demo-target
```

This maps the container image name to this GitHub repository, so the agent can correlate events with the source code in `src/scenarios.ts`.

## Project Structure

```
├── src/
│   ├── app.ts           # Express server — scenario endpoints
│   ├── scenarios.ts     # 6 attack scenario implementations
│   └── payload.c        # Minimal C binary (compiled at Docker build)
├── jibril/
│   ├── config.yaml      # Jibril config enabling required event kinds
│   ├── setup.sh         # Installs config to /etc/jibril/
│   └── alchemies/       # Private alchemies with shell reactions
│       ├── forward-credential-access.yaml
│       ├── forward-unusual-exec.yaml
│       ├── forward-crypto-miner.yaml
│       ├── forward-threat-domain.yaml
│       └── forward-linker-attack.yaml
├── scripts/
│   └── run-scenarios.sh # Convenience: triggers all scenarios + checks agent
├── docker-compose.yml
├── Dockerfile
├── package.json
└── tsconfig.json
```

## Important Notes

- **This is a testing/demo tool only.** All "malicious" operations are benign simulations.
- The C payload binary (`demo-payload`) simply prints a message and exits.
- Network connections use non-routable IPs (`192.0.2.x` — RFC 5737 TEST-NET) to avoid real external traffic.
- The container requires some elevated permissions to perform the file operations (reading `/etc/shadow`, writing `/etc/sudoers.d/`).
- Jibril must run on the **host** (not in a container) because eBPF requires host-level access.
