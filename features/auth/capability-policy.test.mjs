import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCapabilityAccess } from "./capability-policy.mjs";
import { canAccessPath, capabilityForPath } from "./route-capabilities.mjs";

const roleCapabilities = {
  PLATFORM_ADMIN: ["platform.console.access", "platform.establishments.manage", "platform.pages.manage", "platform.features.manage", "platform.settings.manage", "platform.manager-access.manage"],
  ADMIN: ["establishment.console.access", "establishment.dashboard.view", "establishment.agenda.manage", "establishment.appointments.manage", "establishment.customers.manage", "establishment.employees.manage", "establishment.services.manage", "establishment.reports.view", "establishment.settings.manage", "establishment.notifications.view", "establishment.advanced-use"],
  EMPLOYEE: ["employee.appointments.manage", "employee.schedule.view", "employee.clients.view", "employee.availability.manage", "employee.profile.manage"],
  CUSTOMER: ["customer.profile.manage", "customer.appointments.view", "public.booking.create"],
};
const access = (role, capability, tenant, target) => evaluateCapabilityAccess({ role, capability, allowedCapabilities: roleCapabilities[role] ?? [], boundEstablishmentId: tenant, targetEstablishmentId: target });

test("platform owner can manage platform, never operational data", () => {
  assert.equal(access("PLATFORM_ADMIN", "platform.pages.manage"), true);
  assert.equal(access("PLATFORM_ADMIN", "establishment.appointments.manage", "est-1", "est-1"), false);
  assert.equal(access("PLATFORM_ADMIN", "establishment.services.manage", "est-1", "est-1"), false);
});

test("establishment owner is confined to its bound establishment", () => {
  assert.equal(access("ADMIN", "establishment.services.manage", "est-1", "est-1"), true);
  assert.equal(access("ADMIN", "establishment.services.manage", "est-1", "est-2"), false);
  assert.equal(access("ADMIN", "platform.pages.manage", "est-1", "est-1"), false);
  assert.equal(access("ADMIN", "establishment.services.manage", null, "est-1"), false);
});

test("employees cannot gain owner or platform capabilities", () => {
  assert.equal(access("EMPLOYEE", "employee.schedule.view", "est-1", "est-1"), true);
  assert.equal(access("EMPLOYEE", "establishment.services.manage", "est-1", "est-1"), false);
  assert.equal(access("EMPLOYEE", "platform.establishments.manage", "est-1", "est-1"), false);
});

test("customers are limited to customer capabilities and bootstrap is explicit", () => {
  assert.equal(access("CUSTOMER", "customer.appointments.view"), true);
  assert.equal(access("CUSTOMER", "establishment.appointments.manage"), false);
  assert.equal(evaluateCapabilityAccess({ capability: "platform.establishments.manage", allowedCapabilities: [], bootstrap: true }), true);
  assert.equal(evaluateCapabilityAccess({ capability: "platform.establishments.manage", allowedCapabilities: [] }), false);
});

test("direct operational URLs resolve to the same capability gates as navigation", () => {
  assert.equal(capabilityForPath("/my-page"), "establishment.settings.manage");
  assert.equal(capabilityForPath("/my-page/editor"), "establishment.settings.manage");
  assert.equal(capabilityForPath("/platform/establishments"), "platform.establishments.manage");
  assert.equal(capabilityForPath("/platform/establishments/est-1/page-builder"), "platform.pages.manage");
  assert.equal(capabilityForPath("/platform/pages"), "platform.pages.manage");
  assert.equal(capabilityForPath("/customer/appointments/apt-1"), "customer.appointments.view");
});

test("all profile route families are isolated and public booking remains reachable", () => {
  const routes = [
    ["PLATFORM_ADMIN", "/platform/establishments", true],
    ["PLATFORM_ADMIN", "/platform/pages/est-1/preview", true],
    ["PLATFORM_ADMIN", "/platform/establishments/est-1/page-builder", true],
    ["PLATFORM_ADMIN", "/dashboard", false],
    ["ADMIN", "/dashboard", true],
    ["ADMIN", "/agenda", true],
    ["ADMIN", "/customers/customer-1", true],
    ["ADMIN", "/employees/employee-1", true],
    ["ADMIN", "/settings/access", true],
    ["ADMIN", "/platform/establishments", false],
    ["ADMIN", "/employee/schedule", false],
    ["EMPLOYEE", "/employee", true],
    ["EMPLOYEE", "/employee/availability", true],
    ["EMPLOYEE", "/employee/appointments/apt-1", true],
    ["EMPLOYEE", "/services", false],
    ["CUSTOMER", "/customer", true],
    ["CUSTOMER", "/customer/appointments/apt-1/reschedule", true],
    ["CUSTOMER", "/customer/history", true],
    ["CUSTOMER", "/appointments", false],
    ["CUSTOMER", "/platform/pages", false],
  ];
  for (const [role, path, expected] of routes) {
    assert.equal(canAccessPath(path, roleCapabilities[role] ?? []), expected, `${role} → ${path}`);
  }
  assert.equal(canAccessPath("/e/barbearia-demo/booking", []), true);
  assert.equal(canAccessPath("/dashboardish", roleCapabilities.ADMIN), false);
});
