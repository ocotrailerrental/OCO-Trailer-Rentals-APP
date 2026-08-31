import { describe, expect, it } from "vitest";
import { addDays, rentalDays, rentalEstimate } from "@/lib/booking";

describe("booking dates", () => {
  it("counts pickup and return inclusively", () => {
    expect(rentalDays("2026-09-01", "2026-09-01")).toBe(1);
    expect(rentalDays("2026-09-01", "2026-09-08")).toBe(8);
    expect(rentalDays("2026-09-08", "2026-09-01")).toBe(0);
  });

  it("adds days without a UTC date shift", () => {
    expect(addDays("2026-12-29", 7)).toBe("2027-01-05");
  });

  it("keeps deposits separate in the estimate", () => {
    const trailer = {
      daily_rate: 100,
      weekly_rate: 500,
      monthly_rate: 1500,
      security_deposit: 200,
    };
    const quote = rentalEstimate(7, trailer as never, 0);
    expect(quote.rentalSubtotal).toBe(500);
    expect(quote.total).toBe(700);
  });
});
