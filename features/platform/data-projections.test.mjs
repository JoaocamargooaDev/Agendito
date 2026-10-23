import test from "node:test";
import assert from "node:assert/strict";
import { platformPageRecord, publicAppointmentRecord, publicAvailabilityAppointmentRecord, publicEmployeeRecord, publicEstablishmentRecord, publicServiceRecord, tenantRecords } from "./data-projections.mjs";

test("tenant projection returns only records bound to the selected establishment", () => {
  const records = [{ id: "a", establishmentId: "one" }, { id: "b", establishmentId: "two" }];
  assert.deepEqual(tenantRecords(records, "one"), [records[0]]);
});

test("public appointment projection removes customer identity, notes and event history", () => {
  const appointment = { id: "apt", establishmentId: "one", customerId: "private-customer", notes: "sensitive", history: [{ origin: "ADMIN" }] };
  const projection = publicAppointmentRecord(appointment);
  assert.equal(projection.customerId, "public-customer");
  assert.equal(projection.notes, undefined);
  assert.equal(projection.history, undefined);
  assert.equal(appointment.customerId, "private-customer", "projection must not mutate persisted data");
  const busy = publicAvailabilityAppointmentRecord(appointment);
  assert.equal(busy.customerId, "public-customer");
  assert.equal(busy.notes, undefined);
  assert.equal(busy.serviceId, "");
  assert.equal(busy.priceInCentsSnapshot, 0);
});

test("public staff and service projections omit internal fields", () => {
  const staff = publicEmployeeRecord({ id: "emp", establishmentId: "one", userId: "user", displayName: "Ana", bio: "Bio", serviceIds: ["svc"], active: true, phone: "secret", commissionPercent: 30 });
  assert.equal(staff.userId, "");
  assert.equal(staff.phone, undefined);
  assert.equal(staff.commissionPercent, undefined);
  const service = publicServiceRecord({ id: "svc", establishmentId: "one", name: "Corte", description: "", durationMinutes: 30, priceInCents: 1000, active: true, employeeOverrides: { emp: { priceInCents: 900 } }, complementaryServiceIds: ["other"], packageOffer: { sessions: 5, discountPercent: 10 } });
  assert.equal(service.employeeOverrides, undefined);
  assert.equal(service.complementaryServiceIds, undefined);
  assert.equal(service.packageOffer, undefined);
});

test("platform projections omit tenant-controlled operations and page booking fields", () => {
  const establishment = publicEstablishmentRecord({ id: "one", name: "Studio", slug: "studio", description: "", phone: "", address: { street: "", number: "", district: "", city: "", state: "", postalCode: "" }, timezone: "UTC", adminUserIds: ["manager"], settings: { businessHours: [] } });
  assert.equal(establishment.settings, undefined);
  assert.equal(establishment.adminUserIds, undefined);
  const page = platformPageRecord({ establishmentId: "one", updatedAt: "now", serviceIds: ["private"], policies: "private config", heroTitle: "Studio", publishedSnapshot: { serviceIds: ["private"], heroTitle: "Public" }, versions: [{ id: "v1", publishedAt: "now", content: { serviceIds: ["private"], heroTitle: "Version" } }] });
  assert.equal(page.serviceIds, undefined);
  assert.equal(page.policies, undefined);
  assert.equal(page.publishedSnapshot.serviceIds, undefined);
  assert.equal(page.versions[0].content.serviceIds, undefined);
});
