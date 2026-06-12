import { describe, it, expect } from "vitest";
import {
  WARNING_DAYS,
  getDocumentStatus,
  getDriverComplianceIssues,
  getDriverComplianceStatus,
  getFleetComplianceAlerts,
} from "./compliance";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REF = new Date(Date.UTC(2026, 5, 12)); // 2026-06-12T00:00:00.000Z

function daysFromRef(days) {
  const d = new Date(REF);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── getDocumentStatus ─────────────────────────────────────────────────────────

describe("getDocumentStatus", () => {
  it("returns 'missing' for null", () => {
    expect(getDocumentStatus(null, REF)).toBe("missing");
  });

  it("returns 'missing' for undefined", () => {
    expect(getDocumentStatus(undefined, REF)).toBe("missing");
  });

  it("returns 'missing' for an invalid date string", () => {
    expect(getDocumentStatus("not-a-date", REF)).toBe("missing");
  });

  it("returns 'expired' for a date in the past", () => {
    expect(getDocumentStatus(daysFromRef(-1), REF)).toBe("expired");
  });

  it("returns 'expiring' for today", () => {
    expect(getDocumentStatus(daysFromRef(0), REF)).toBe("expiring");
  });

  it("returns 'expiring' for a date within the warning window", () => {
    expect(getDocumentStatus(daysFromRef(WARNING_DAYS), REF)).toBe("expiring");
  });

  it("returns 'valid' for a date just beyond the warning window", () => {
    expect(getDocumentStatus(daysFromRef(WARNING_DAYS + 1), REF)).toBe("valid");
  });

  it("returns 'valid' for a date far in the future", () => {
    expect(getDocumentStatus(daysFromRef(365), REF)).toBe("valid");
  });
});

// ─── getDriverComplianceIssues ─────────────────────────────────────────────────

describe("getDriverComplianceIssues", () => {
  it("returns expired and expiring documents with key, label, expiry and status", () => {
    const driver = {
      licenceExpiry: daysFromRef(-1),
      insuranceExpiry: daysFromRef(10),
      motExpiry: daysFromRef(60),
    };

    expect(getDriverComplianceIssues(driver, REF)).toEqual([
      { key: "licenceExpiry", label: "Driving Licence", expiry: driver.licenceExpiry, status: "expired" },
      { key: "insuranceExpiry", label: "Insurance", expiry: driver.insuranceExpiry, status: "expiring" },
    ]);
  });

  it("returns an empty array when all documents are valid", () => {
    const driver = {
      licenceExpiry: daysFromRef(60),
      insuranceExpiry: daysFromRef(90),
      motExpiry: daysFromRef(120),
    };
    expect(getDriverComplianceIssues(driver, REF)).toEqual([]);
  });

  it("does not flag missing documents as issues", () => {
    const driver = { licenceExpiry: null, insuranceExpiry: null, motExpiry: null };
    expect(getDriverComplianceIssues(driver, REF)).toEqual([]);
  });
});

// ─── getDriverComplianceStatus ─────────────────────────────────────────────────

describe("getDriverComplianceStatus", () => {
  it("returns 'expired' if any document is expired", () => {
    const driver = {
      licenceExpiry: daysFromRef(-1),
      insuranceExpiry: daysFromRef(10),
      motExpiry: daysFromRef(60),
    };
    expect(getDriverComplianceStatus(driver, REF)).toBe("expired");
  });

  it("returns 'expiring' if a document is expiring soon but none expired", () => {
    const driver = {
      licenceExpiry: daysFromRef(10),
      insuranceExpiry: daysFromRef(60),
      motExpiry: daysFromRef(90),
    };
    expect(getDriverComplianceStatus(driver, REF)).toBe("expiring");
  });

  it("returns 'valid' when all documents are valid", () => {
    const driver = {
      licenceExpiry: daysFromRef(60),
      insuranceExpiry: daysFromRef(90),
      motExpiry: daysFromRef(120),
    };
    expect(getDriverComplianceStatus(driver, REF)).toBe("valid");
  });

  it("returns 'valid' when all documents are missing", () => {
    const driver = { licenceExpiry: null, insuranceExpiry: null, motExpiry: null };
    expect(getDriverComplianceStatus(driver, REF)).toBe("valid");
  });
});

// ─── getFleetComplianceAlerts ──────────────────────────────────────────────────

describe("getFleetComplianceAlerts", () => {
  it("returns only drivers with at least one compliance issue", () => {
    const okDriver = {
      id: "d1",
      licenceExpiry: daysFromRef(60),
      insuranceExpiry: daysFromRef(60),
      motExpiry: daysFromRef(60),
    };
    const expiredDriver = {
      id: "d2",
      licenceExpiry: daysFromRef(-5),
      insuranceExpiry: daysFromRef(60),
      motExpiry: daysFromRef(60),
    };

    const alerts = getFleetComplianceAlerts([okDriver, expiredDriver], REF);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].driver).toBe(expiredDriver);
    expect(alerts[0].issues).toHaveLength(1);
    expect(alerts[0].issues[0]).toMatchObject({ key: "licenceExpiry", status: "expired" });
  });

  it("returns an empty array when no drivers have issues", () => {
    const okDriver = {
      id: "d1",
      licenceExpiry: daysFromRef(60),
      insuranceExpiry: daysFromRef(60),
      motExpiry: daysFromRef(60),
    };
    expect(getFleetComplianceAlerts([okDriver], REF)).toEqual([]);
  });
});
