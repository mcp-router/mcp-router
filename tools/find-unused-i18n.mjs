#!/usr/bin/env node

/**
 * Detect (and optionally remove) unused i18n keys.
 *
 * Scans locale JSON files under apps/electron/src/locales and checks
 * whether keys appear in the codebase (ts/tsx/js/jsx/mjs/cjs/mdx/md files).
 *
 * Usage:
 *   node tools/find-unused-i18n.mjs          # report only
 *   node tools/find-unused-i18n.mjs --apply  # remove unused keys from all locale files
 */

import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const localeDir = path.join(repoRoot, "apps", "electron", "src", "locales");
const codeRoots = [
  path.join(repoRoot, "apps"),
  path.join(repoRoot, "packages"),
];

const APPLY = process.argv.includes("--apply");

const FILE_PATTERNS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".md",
  ".mdx",
];

const isCodeFile = (file) => FILE_PATTERNS.some((ext) => file.endsWith(ext));

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const flattenKeys = (obj, prefix = "") => {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const newPrefix = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, newPrefix));
    } else {
      keys.push(newPrefix);
    }
  }
  return keys;
};

const walkFiles = (dir, collector) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip locale directory itself
      if (full.startsWith(localeDir)) continue;
      walkFiles(full, collector);
    } else if (entry.isFile() && isCodeFile(entry.name)) {
      collector(full);
    }
  }
};

const collectUsage = () => {
  const usage = new Set(); // exact keys
  const prefixes = new Set(); // prefixes from template literals
  const add = (key) => usage.add(key);
  const addPrefix = (p) => p && prefixes.add(p);

  const regexes = [
    /t\(\s*["'`]([^"'`]+)["'`]/g,
    /i18n\.t\(\s*["'`]([^"'`]+)["'`]/g,
    /<Trans[^>]*i18nKey=["']([^"']+)["']/g,
    /t\(\s*`([^`]+?)`/g,
    /i18n\.t\(\s*`([^`]+?)`/g,
    /i18nKey=\{`([^`]+?)`/g,
  ];

  const scanFile = (file) => {
    const content = fs.readFileSync(file, "utf8");
    for (const regex of regexes) {
      for (const match of content.matchAll(regex)) {
        const raw = match[1];
        if (!raw) continue;
        if (raw.includes("${")) {
          const [head] = raw.split("${");
          addPrefix(head);
        } else {
          add(raw);
        }
      }
    }
  };

  for (const root of codeRoots) {
    if (fs.existsSync(root)) {
      walkFiles(root, scanFile);
    }
  }

  return { usage, prefixes };
};

const localeFiles = fs
  .readdirSync(localeDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => path.join(localeDir, f));

const { usage, prefixes } = collectUsage();

const report = [];

for (const localeFile of localeFiles) {
  const data = readJson(localeFile);
  const keys = flattenKeys(data);
  const unused = keys.filter(
    (k) => !usage.has(k) && ![...prefixes].some((p) => k.startsWith(p)),
  );
  report.push({ localeFile, unused });

  if (APPLY && unused.length > 0) {
    // Remove unused keys from JSON object
    const removeKey = (target, pathParts) => {
      const [head, ...rest] = pathParts;
      if (!(head in target)) return;
      if (rest.length === 0) {
        delete target[head];
        return;
      }
      removeKey(target[head], rest);
      if (
        target[head] &&
        typeof target[head] === "object" &&
        !Array.isArray(target[head]) &&
        Object.keys(target[head]).length === 0
      ) {
        delete target[head];
      }
    };

    for (const key of unused) {
      removeKey(data, key.split("."));
    }

    fs.writeFileSync(localeFile, JSON.stringify(data, null, 2) + "\n");
  }
}

const totalUnused = report.reduce((sum, r) => sum + r.unused.length, 0);
if (totalUnused === 0) {
  console.log("No unused i18n keys found.");
} else {
  console.log(`Found ${totalUnused} unused i18n keys:`);
  for (const { localeFile, unused } of report) {
    if (unused.length === 0) continue;
    console.log(`\n${path.relative(repoRoot, localeFile)} (${unused.length})`);
    for (const key of unused.sort()) {
      console.log(`  - ${key}`);
    }
  }
  if (APPLY) {
    console.log("\nUnused keys removed (see git diff).");
  } else {
    console.log('\nRe-run with "--apply" to remove them.');
  }
}
