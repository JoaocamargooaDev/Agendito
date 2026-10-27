const routeCapabilities = [
  ["/platform/establishments", "platform.establishments.manage"],
  ["/platform/pages", "platform.pages.manage"],
  ["/platform", "platform.console.access"],
  ["/dashboard", "establishment.dashboard.view"], ["/agenda", "establishment.agenda.manage"],
  ["/appointments", "establishment.appointments.manage"], ["/customers", "establishment.customers.manage"],
  ["/employees", "establishment.employees.manage"], ["/services", "establishment.services.manage"],
  ["/reports", "establishment.reports.view"], ["/settings", "establishment.settings.manage"],
  ["/my-page", "establishment.settings.manage"], ["/features", "establishment.advanced-use"],
  ["/employee/schedule", "employee.schedule.view"], ["/employee/appointments", "employee.appointments.manage"],
  ["/employee/clients", "employee.clients.view"], ["/employee/availability", "employee.availability.manage"],
  ["/employee/profile", "employee.profile.manage"], ["/employee", "employee.schedule.view"],
  ["/customer/profile", "customer.profile.manage"], ["/customer/appointments", "customer.appointments.view"],
  ["/customer/history", "customer.appointments.view"], ["/customer", "customer.appointments.view"],
];

export function capabilityForPath(pathname) {
  const path = pathname.split(/[?#]/, 1)[0];
  if (/^\/platform\/establishments\/[^/]+\/page-builder(?:\/|$)/.test(path)) return "platform.pages.manage";
  return routeCapabilities.find(([base]) => path === base || path.startsWith(`${base}/`))?.[1] ?? null;
}

export function canAccessPath(pathname, allowedCapabilities) {
  const path = pathname.split(/[?#]/, 1)[0];
  const required = capabilityForPath(path);
  if (required) return allowedCapabilities.includes(required);
  return path === "/booking" || /^\/e\/[^/]+(?:\/booking)?(?:\/|$)/.test(path);
}
