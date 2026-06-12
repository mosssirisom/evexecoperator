// Driver document compliance — licence, insurance and MOT expiry tracking.

export const WARNING_DAYS = 30;

export const COMPLIANCE_DOCUMENTS = [
  { key: "licenceExpiry", label: "Driving Licence" },
  { key: "insuranceExpiry", label: "Insurance" },
  { key: "motExpiry", label: "MOT" },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Returns "missing" | "expired" | "expiring" | "valid" for a single expiry date. */
export function getDocumentStatus(expiryDate, referenceDate = new Date()) {
  if (!expiryDate) return "missing";

  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime())) return "missing";

  const diffDays = Math.ceil((expiry.getTime() - referenceDate.getTime()) / MS_PER_DAY);
  if (diffDays < 0) return "expired";
  if (diffDays <= WARNING_DAYS) return "expiring";
  return "valid";
}

/** Returns the subset of a driver's compliance documents that are expired or expiring soon. */
export function getDriverComplianceIssues(driver, referenceDate = new Date()) {
  return COMPLIANCE_DOCUMENTS.map((doc) => ({
    ...doc,
    expiry: driver[doc.key] ?? null,
    status: getDocumentStatus(driver[doc.key], referenceDate),
  })).filter((doc) => doc.status === "expired" || doc.status === "expiring");
}

/** Returns the worst compliance status across a driver's tracked documents. */
export function getDriverComplianceStatus(driver, referenceDate = new Date()) {
  const issues = getDriverComplianceIssues(driver, referenceDate);
  if (issues.some((i) => i.status === "expired")) return "expired";
  if (issues.some((i) => i.status === "expiring")) return "expiring";
  return "valid";
}

/** Returns { driver, issues } for every driver with at least one expired/expiring document. */
export function getFleetComplianceAlerts(drivers, referenceDate = new Date()) {
  return drivers
    .map((driver) => ({ driver, issues: getDriverComplianceIssues(driver, referenceDate) }))
    .filter(({ issues }) => issues.length > 0);
}
