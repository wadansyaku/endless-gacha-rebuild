"use strict";

function isSupportedNodeVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return false;
  const [major, minor, patch] = version.split(".").map(Number);
  const floor = { 22: [23, 4], 24: [22, 1], 26: [12, 1] }[major];
  return Boolean(floor && (minor > floor[0] || (minor === floor[0] && patch >= floor[1])));
}

if (require.main === module) {
  console.log(`Node.js security build runtime: ${process.version}`);
  if (!isSupportedNodeVersion(process.versions.node)) {
    console.error("Stable patched Node.js >=22.23.4 <23, >=24.22.1 <25, or >=26.12.1 <27 is required.");
    process.exitCode = 1;
  }
}

module.exports = { isSupportedNodeVersion };
