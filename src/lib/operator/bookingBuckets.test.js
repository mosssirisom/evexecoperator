import { describe, it, expect } from "vitest";
import { awaitingReply, needsDriver, unpaidCompleted, boardColumn } from "./bookingBuckets";

const b = (o) => ({ status: "Unassigned", source: "operator", operatorResponse: null, driverId: null, paymentStatus: "Unpaid", travelDate: "2026-10-14", ...o });

describe("booking buckets", () => {
  it("a new website request needs a reply, not a driver", () => {
    const x = b({ source: "website" });
    expect(awaitingReply(x)).toBe(true);
    expect(needsDriver(x)).toBe(false);
    expect(boardColumn(x, "2026-10-14")).toBe("reply");
  });
  it("an accepted request without a driver needs a driver", () => {
    const x = b({ source: "website", operatorResponse: "accepted" });
    expect(needsDriver(x)).toBe(true);
    expect(boardColumn(x, "2026-10-14")).toBe("driver");
  });
  it("assigned, on the road and done", () => {
    expect(boardColumn(b({ status: "Dispatched", driverId: "d1" }), "2026-10-14")).toBe("assigned");
    expect(boardColumn(b({ status: "En Route", driverId: "d1" }), "2026-10-14")).toBe("road");
    expect(boardColumn(b({ status: "Completed", driverId: "d1" }), "2026-10-14")).toBe("done");
    expect(boardColumn(b({ status: "Completed", driverId: "d1", travelDate: "2026-10-13" }), "2026-10-14")).toBeNull();
    expect(boardColumn(b({ status: "Cancelled" }), "2026-10-14")).toBeNull();
  });
  it("unpaid means completed, not paid, not cash", () => {
    expect(unpaidCompleted(b({ status: "Completed" }))).toBe(true);
    expect(unpaidCompleted(b({ status: "Completed", paymentStatus: "Paid" }))).toBe(false);
    expect(unpaidCompleted(b({ status: "Completed", paymentMethod: "Cash" }))).toBe(false);
    expect(unpaidCompleted(b({ status: "Dispatched" }))).toBe(false);
  });
});
