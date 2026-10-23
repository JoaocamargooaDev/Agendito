export function tenantRecords(records, establishmentId) {
  return records.filter((record) => record.establishmentId === establishmentId);
}

export function publicAppointmentRecord(appointment) {
  return { ...appointment, customerId: "public-customer", notes: undefined, history: undefined };
}

export function publicAvailabilityAppointmentRecord(appointment) {
  return {
    id: appointment.id,
    establishmentId: appointment.establishmentId,
    employeeId: appointment.employeeId,
    customerId: "public-customer",
    serviceId: "",
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    status: appointment.status,
    serviceNameSnapshot: "",
    serviceSnapshots: [],
    durationMinutesSnapshot: 0,
    priceInCentsSnapshot: 0,
    createdAt: "",
  };
}

export function publicEmployeeRecord(employee) {
  return {
    id: employee.id,
    establishmentId: employee.establishmentId,
    userId: "",
    displayName: employee.displayName,
    bio: employee.bio,
    serviceIds: employee.serviceIds,
    active: employee.active,
    title: employee.title,
    photoUrl: employee.photoUrl,
  };
}

export function publicServiceRecord(service) {
  const { employeeOverrides: _employeeOverrides, complementaryServiceIds: _complementaryServiceIds, packageOffer: _packageOffer, ...publicRecord } = service;
  return publicRecord;
}

export function publicEstablishmentRecord(establishment) {
  const { settings: _settings, adminUserIds: _adminUserIds, ...publicRecord } = establishment;
  return publicRecord;
}

export function platformPageRecord(config) {
  const privateFields = ["serviceIds", "employeeIds", "allowProfessionalChoice", "allowGuestBooking", "bookingFields", "allowCustomerCancel", "allowCustomerReschedule", "policies"];
  const omitOperational = (content) => Object.fromEntries(Object.entries(content).filter(([key]) => !privateFields.includes(key)));
  const { publishedSnapshot, versions, ...page } = config;
  return {
    ...omitOperational(page),
    ...(publishedSnapshot ? { publishedSnapshot: omitOperational(publishedSnapshot) } : {}),
    ...(versions ? { versions: versions.map(({ content, ...version }) => ({ ...version, content: omitOperational(content) })) } : {}),
  };
}
