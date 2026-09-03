#!/usr/bin/env node
// Validates required environment variables against the split defined in
// workflows/architecture-communication.md (section 5). Plain Node ESM, no
// dependencies, so it runs before package.json/npm install exist.
//
// Usage: node tools/check-env.mjs [--group=vercel|trigger|all]

const GROUPS = {
  vercel: {
    label: "Vercel (frontend project)",
    vars: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "TRIGGER_SECRET_KEY",
      "TRIGGER_PUBLIC_API_KEY",
      "SENTRY_DSN",
      "NEXT_PUBLIC_POSTHOG_KEY",
    ],
  },
  trigger: {
    label: "Trigger.dev (backend project)",
    vars: [
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
      "TAVILY_API_KEY",
      "FIRECRAWL_API_KEY",
      "OPENAI_API_KEY",
      "ELEVENLABS_API_KEY",
      "SENTRY_DSN",
    ],
  },
};

function parseGroupArg() {
  const arg = process.argv.find((a) => a.startsWith("--group="));
  const value = arg ? arg.split("=")[1] : "all";
  if (!["vercel", "trigger", "all"].includes(value)) {
    console.error(`Unknown --group value "${value}". Use vercel, trigger, or all.`);
    process.exit(2);
  }
  return value;
}

function checkGroup(name, { label, vars }) {
  console.log(`\n${label}:`);
  let missing = 0;
  for (const key of vars) {
    const present = typeof process.env[key] === "string" && process.env[key].length > 0;
    console.log(`  [${present ? "x" : " "}] ${key}`);
    if (!present) missing += 1;
  }
  return missing;
}

const requested = parseGroupArg();
const groupsToCheck = requested === "all" ? Object.entries(GROUPS) : [[requested, GROUPS[requested]]];

let totalMissing = 0;
for (const [name, group] of groupsToCheck) {
  totalMissing += checkGroup(name, group);
}

console.log(
  `\n${totalMissing === 0 ? "All required variables are set." : `${totalMissing} required variable(s) missing.`}`
);

if (totalMissing > 0) {
  console.log(
    "This is expected before Phase 1 sets up real Supabase/Trigger.dev/provider projects — " +
      "see workflows/phase-1-foundation.md and .env.example (added in Phase 1)."
  );
}

process.exit(totalMissing > 0 ? 1 : 0);
