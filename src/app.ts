import express from "express";
import { SCENARIOS, SCENARIO_NAMES, type ScenarioResult } from "./scenarios.js";

const PORT = parseInt(process.env.PORT ?? "8080", 10);
const app = express();

app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "jibril-demo-target",
    scenarios: SCENARIO_NAMES,
  });
});

// List available scenarios
app.get("/scenarios", (_req, res) => {
  res.json({ scenarios: SCENARIO_NAMES });
});

// Run a specific scenario
app.post("/scenario/:name", (req, res) => {
  const name = req.params.name;

  if (name === "all") {
    runAll(res);
    return;
  }

  const fn = SCENARIOS[name];
  if (!fn) {
    res.status(404).json({
      error: `Unknown scenario: ${name}`,
      available: SCENARIO_NAMES,
    });
    return;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Triggering scenario: ${name}`);
  console.log("=".repeat(60));

  const result = fn();
  res.json(result);
});

// Run all scenarios sequentially with delays
function runAll(res: express.Response) {
  console.log(`\n${"=".repeat(60)}`);
  console.log("Triggering ALL scenarios sequentially");
  console.log("=".repeat(60));

  const results: ScenarioResult[] = [];
  const names = [...SCENARIO_NAMES];
  let index = 0;

  function next() {
    if (index >= names.length) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`All ${results.length} scenarios complete.`);
      console.log("=".repeat(60));
      res.json({ total: results.length, results });
      return;
    }

    const name = names[index++];
    const fn = SCENARIOS[name];
    const result = fn();
    results.push(result);

    if (index < names.length) {
      console.log(`  [delay] Waiting 2s before next scenario...`);
      setTimeout(next, 2000);
    } else {
      next();
    }
  }

  next();
}

// Start server
app.listen(PORT, () => {
  console.log(`\nJibril Demo Target listening on port ${PORT}`);
  console.log(`  GET  /health           — Health check`);
  console.log(`  GET  /scenarios        — List available scenarios`);
  console.log(`  POST /scenario/:name   — Run a specific scenario`);
  console.log(`  POST /scenario/all     — Run all scenarios with delays`);
  console.log(`\nAvailable scenarios:`);
  for (const name of SCENARIO_NAMES) {
    console.log(`  - ${name}`);
  }
  console.log("");
});
