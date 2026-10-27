import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./status.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const status = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

test("appointment transitions are centralized and terminal statuses cannot be reopened", () => {
  assert.deepEqual(status.getAppointmentTransitions("SCHEDULED"), ["CONFIRMED", "IN_PROGRESS", "CANCELLED", "NO_SHOW"]);
  assert.equal(status.canTransitionAppointment("CONFIRMED", "CANCELLED"), true);
  assert.equal(status.canTransitionAppointment("COMPLETED", "CONFIRMED"), false);
  assert.equal(status.canTransitionAppointment("CANCELLED", "CONFIRMED"), false);
  assert.equal(status.canTransitionAppointment("NO_SHOW", "CONFIRMED"), false);
  assert.deepEqual(status.getAppointmentTransitions("COMPLETED"), []);
});

test("cancelled appointments no longer occupy availability while active appointments do", () => {
  assert.equal(status.isActiveAppointmentStatus("SCHEDULED"), true);
  assert.equal(status.isActiveAppointmentStatus("IN_PROGRESS"), true);
  assert.equal(status.isActiveAppointmentStatus("CANCELLED"), false);
  assert.equal(status.isEditableAppointmentStatus("COMPLETED"), false);
});
