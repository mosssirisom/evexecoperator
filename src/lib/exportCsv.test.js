import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportBookingsCsv } from "./exportCsv";

function sampleBooking(overrides = {}) {
  return {
    id: "EVX-1234",
    customer: "Smith, John",
    phone: "+44 7700 900000",
    email: "john@example.com",
    route: "Manchester Airport → Blackpool",
    airport: "Manchester Airport",
    destination: "Blackpool",
    direction: "Airport → Destination",
    flight: "EK017",
    pickupTime: "2025-07-01T10:45:00.000Z",
    driver: "Nitisat Siri",
    price: "£160",
    status: "Dispatched",
    paymentStatus: "Paid",
    priority: true,
    notes: 'Note with "quotes"',
    ...overrides,
  };
}

describe("exportBookingsCsv", () => {
  let createObjectURL, revokeObjectURL, clickSpy, anchors, lastCsv;

  beforeEach(() => {
    anchors = [];
    lastCsv = null;

    createObjectURL = vi.fn(() => "blob:mock-url");
    revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    vi.spyOn(globalThis, "Blob").mockImplementation(function (parts) {
      lastCsv = parts.join("");
      return {};
    });

    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = realCreateElement(tag);
      if (tag === "a") anchors.push(el);
      return el;
    });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes a header row with all expected columns", () => {
    exportBookingsCsv([sampleBooking()]);

    const [header] = lastCsv.split("\n");
    expect(header).toBe(
      "Ref,Customer,Phone,Email,Route,Airport,Destination,Direction,Flight,Pickup Date,Pickup Time,Driver,Price,Status,Payment Status,Priority,Notes"
    );
  });

  it("escapes values containing commas and quotes", () => {
    exportBookingsCsv([sampleBooking()]);

    const [, row] = lastCsv.split("\n");
    expect(row).toContain('"Smith, John"');
    expect(row).toContain('"Note with ""quotes"""');
    expect(row).toContain("Yes"); // priority -> "Yes"
  });

  it("formats pickup date and time and falls back to empty for missing flight", () => {
    exportBookingsCsv([sampleBooking({ customer: "John Smith", notes: "", flight: "—", pickupTime: null })]);

    const [, row] = lastCsv.split("\n");
    const cols = row.split(",");

    // Flight column (index 8) should be empty since "—" is a placeholder
    expect(cols[8]).toBe("");
    // Pickup Date / Time columns (9, 10) should be empty when pickupTime is null
    expect(cols[9]).toBe("");
    expect(cols[10]).toBe("");
  });

  it("triggers a download with the given filename via an anchor click", () => {
    exportBookingsCsv([sampleBooking()], "my-export.csv");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].getAttribute("href")).toBe("blob:mock-url");
    expect(anchors[0].getAttribute("download")).toBe("my-export.csv");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("uses the default filename when none is provided", () => {
    exportBookingsCsv([sampleBooking()]);
    expect(anchors[0].getAttribute("download")).toBe("evexec-bookings.csv");
  });

  it("renders an empty body when given no bookings", () => {
    exportBookingsCsv([]);
    expect(lastCsv.split("\n")).toHaveLength(1); // header row only
  });
});
