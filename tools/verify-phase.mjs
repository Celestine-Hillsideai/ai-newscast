#!/usr/bin/env node
// Runs the universal Definition of Done from workflows/00-overview.md:
// typecheck -> lint -> test, stopping at the first failure. Safe to run
// before Phase 1 exists: if there's no package.json yet, it says so and
// exits 0 instead of erroring.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));

if (!existsSync(packageJsonPath)) {
  console.log(
    "No package.json found yet — Phase 1 has not started. Nothing to verify.\n" +
      "See workflows/phase-1-foundation.md."
  );
  process.exit(0);
}

const steps = [
  { name: "typecheck", command: "npm", args: ["run", "typecheck"] },
  { name: "lint", command: "npm", args: ["run", "lint"] },
  { name: "test", command: "npm", args: ["test"] },
];

for (const step of steps) {
  console.log(`\n> ${step.name} (${step.command} ${step.args.join(" ")})`);
  const result = spawnSync(step.command, step.args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`\n${step.name} failed. Fix errors before proceeding to the next phase.`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nAll checks passed. Verify the phase manually, then update its status in workflows/.");
