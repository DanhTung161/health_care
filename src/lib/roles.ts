export const USER_ROLES = ["ADMIN", "DOCTOR", "STAFF"] as const;

export type Role = (typeof USER_ROLES)[number];

export const roleLandingPage: Record<Role, string> = {
  ADMIN: "/dashboard",
  DOCTOR: "/appointments",
  STAFF: "/patients",
};

export const allowedRoutePrefixes: Record<Exclude<Role, "ADMIN">, string[]> = {
  DOCTOR: ["/appointments", "/patients", "/api/appointments", "/api/patients"],
  STAFF: ["/appointments", "/patients", "/api/appointments", "/api/patients"],
};

export function isRole(value: unknown): value is Role {
  return USER_ROLES.some((role) => role === value);
}
