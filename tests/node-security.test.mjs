import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedNodeVersion } from "../scripts/check-node-security.cjs";

for (const version of ["22.23.4", "22.23.5", "22.24.0", "24.22.1", "24.23.0", "26.12.1", "26.13.0"]) {
  test(`accept supported patched stable Node ${version}`, () => assert.equal(isSupportedNodeVersion(version), true));
}
for (const version of ["18.20.0", "20.19.0", "22.16.0", "22.23.3", "22.22.9", "23.0.0", "24.22.0", "24.21.99", "25.0.0", "26.12.0", "26.11.99", "27.0.0", "24.22.1-rc.1", "24.23.0-rc.1", "24.22.NaN", "24.22", "x.22.1"]) {
  test(`reject unsupported or unpatched Node ${version}`, () => assert.equal(isSupportedNodeVersion(version), false));
}
