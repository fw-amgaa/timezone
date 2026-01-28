import { describe, it, expect } from "vitest";
import {
  calculateShiftDuration,
  formatDuration,
  formatDurationFromMinutes,
  isShiftStale,
  validateShiftDuration,
  calculateAutoBreak,
  calculateOvertime,
} from "./index";

describe("calculateShiftDuration", () => {
  describe("basic duration calculations", () => {
    it("should calculate a standard 8-hour shift correctly", () => {
      const result = calculateShiftDuration(
        new Date("2024-01-15T09:00:00Z"),
        new Date("2024-01-15T17:00:00Z")
      );

      expect(result.totalMinutes).toBe(480);
      expect(result.hours).toBe(8);
      expect(result.minutes).toBe(0);
      expect(result.formatted).toBe("8h");
      expect(result.crossedMidnight).toBe(false);
    });

    it("should calculate partial hour shifts correctly", () => {
      const result = calculateShiftDuration(
        new Date("2024-01-15T09:00:00Z"),
        new Date("2024-01-15T17:30:00Z")
      );

      expect(result.totalMinutes).toBe(510);
      expect(result.hours).toBe(8);
      expect(result.minutes).toBe(30);
      expect(result.formatted).toBe("8h 30m");
    });

    it("should handle short shifts", () => {
      const result = calculateShiftDuration(
        new Date("2024-01-15T09:00:00Z"),
        new Date("2024-01-15T09:45:00Z")
      );

      expect(result.totalMinutes).toBe(45);
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(45);
      expect(result.formatted).toBe("45m");
    });
  });

  describe("midnight crossing shifts (Hospital Case)", () => {
    it("should calculate 11 PM to 3 AM shift as 4 hours", () => {
      const result = calculateShiftDuration(
        new Date("2024-01-15T23:00:00Z"),
        new Date("2024-01-16T03:00:00Z")
      );

      expect(result.totalMinutes).toBe(240);
      expect(result.hours).toBe(4);
      expect(result.minutes).toBe(0);
      expect(result.crossedMidnight).toBe(true);
    });

    it("should calculate 8 PM to 6 AM shift as 10 hours", () => {
      const result = calculateShiftDuration(
        new Date("2024-01-15T20:00:00Z"),
        new Date("2024-01-16T06:00:00Z")
      );

      expect(result.totalMinutes).toBe(600);
      expect(result.hours).toBe(10);
      expect(result.minutes).toBe(0);
      expect(result.crossedMidnight).toBe(true);
    });

    it("should calculate typical night shift (7 PM to 7 AM) as 12 hours", () => {
      const result = calculateShiftDuration(
        new Date("2024-01-15T19:00:00Z"),
        new Date("2024-01-16T07:00:00Z")
      );

      expect(result.totalMinutes).toBe(720);
      expect(result.hours).toBe(12);
      expect(result.minutes).toBe(0);
      expect(result.crossedMidnight).toBe(true);
    });

    it("should handle overnight shift with odd minutes (11:30 PM to 2:45 AM)", () => {
      const result = calculateShiftDuration(
        new Date("2024-01-15T23:30:00Z"),
        new Date("2024-01-16T02:45:00Z")
      );

      expect(result.totalMinutes).toBe(195); // 3 hours 15 minutes
      expect(result.hours).toBe(3);
      expect(result.minutes).toBe(15);
      expect(result.crossedMidnight).toBe(true);
    });

    it("should attribute midnight-crossing shift to the START date", () => {
      const result = calculateShiftDuration(
        new Date("2024-01-15T23:00:00Z"),
        new Date("2024-01-16T07:00:00Z")
      );

      // Should be attributed to Jan 15, not Jan 16
      expect(result.attributedDate.toISOString().startsWith("2024-01-15")).toBe(true);
    });
  });

  describe("break deductions", () => {
    it("should deduct break minutes from net duration", () => {
      const result = calculateShiftDuration(
        new Date("2024-01-15T09:00:00Z"),
        new Date("2024-01-15T17:00:00Z"),
        30 // 30 minute break
      );

      expect(result.totalMinutes).toBe(480);
      expect(result.netMinutes).toBe(450); // 480 - 30
      expect(result.hours).toBe(7);
      expect(result.minutes).toBe(30);
    });

    it("should not allow negative net duration", () => {
      const result = calculateShiftDuration(
        new Date("2024-01-15T09:00:00Z"),
        new Date("2024-01-15T09:15:00Z"),
        60 // 60 minute break (more than shift)
      );

      expect(result.netMinutes).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should throw error if clock in is after clock out", () => {
      expect(() =>
        calculateShiftDuration(
          new Date("2024-01-15T17:00:00Z"),
          new Date("2024-01-15T09:00:00Z")
        )
      ).toThrow("Clock in time cannot be after clock out time");
    });

    it("should accept ISO string dates", () => {
      const result = calculateShiftDuration(
        "2024-01-15T09:00:00Z",
        "2024-01-15T17:00:00Z"
      );

      expect(result.totalMinutes).toBe(480);
    });
  });
});

describe("formatDuration", () => {
  it("should format zero duration", () => {
    expect(formatDuration(0, 0)).toBe("0m");
  });

  it("should format hours only", () => {
    expect(formatDuration(8, 0)).toBe("8h");
  });

  it("should format minutes only", () => {
    expect(formatDuration(0, 45)).toBe("45m");
  });

  it("should format hours and minutes", () => {
    expect(formatDuration(8, 30)).toBe("8h 30m");
  });
});

describe("formatDurationFromMinutes", () => {
  it("should convert 480 minutes to 8h", () => {
    expect(formatDurationFromMinutes(480)).toBe("8h");
  });

  it("should convert 510 minutes to 8h 30m", () => {
    expect(formatDurationFromMinutes(510)).toBe("8h 30m");
  });

  it("should convert 45 minutes to 45m", () => {
    expect(formatDurationFromMinutes(45)).toBe("45m");
  });
});

describe("isShiftStale", () => {
  it("should return false for recent shift", () => {
    const recentClockIn = new Date();
    expect(isShiftStale(recentClockIn)).toBe(false);
  });

  it("should return true for shift open >16 hours", () => {
    const oldClockIn = new Date();
    oldClockIn.setHours(oldClockIn.getHours() - 17);
    expect(isShiftStale(oldClockIn)).toBe(true);
  });

  it("should respect custom threshold", () => {
    const clockIn = new Date();
    clockIn.setHours(clockIn.getHours() - 5);

    expect(isShiftStale(clockIn, 4)).toBe(true); // 4 hour threshold
    expect(isShiftStale(clockIn, 8)).toBe(false); // 8 hour threshold
  });
});

describe("validateShiftDuration", () => {
  it("should validate normal shift", () => {
    const result = validateShiftDuration(480); // 8 hours
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should reject too short shift", () => {
    const result = validateShiftDuration(2); // 2 minutes
    expect(result.valid).toBe(false);
    expect(result.error).toContain("less than minimum");
  });

  it("should reject too long shift", () => {
    const result = validateShiftDuration(1500); // 25 hours
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds maximum");
  });

  it("should respect custom bounds", () => {
    const result = validateShiftDuration(10, 15, 60);
    expect(result.valid).toBe(false);
  });
});

describe("calculateAutoBreak", () => {
  it("should return 0 for shifts under threshold", () => {
    expect(calculateAutoBreak(300, 6, 30)).toBe(0); // 5 hours
  });

  it("should return break minutes for shifts at or over threshold", () => {
    expect(calculateAutoBreak(360, 6, 30)).toBe(30); // exactly 6 hours
    expect(calculateAutoBreak(480, 6, 30)).toBe(30); // 8 hours
  });
});

describe("calculateOvertime", () => {
  it("should calculate no overtime for under 40 hours", () => {
    const result = calculateOvertime(2100); // 35 hours
    expect(result.regularHours).toBe(35);
    expect(result.overtimeHours).toBe(0);
    expect(result.totalHours).toBe(35);
  });

  it("should calculate overtime for over 40 hours", () => {
    const result = calculateOvertime(2700); // 45 hours
    expect(result.regularHours).toBe(40);
    expect(result.overtimeHours).toBe(5);
    expect(result.totalHours).toBe(45);
  });

  it("should handle exactly 40 hours", () => {
    const result = calculateOvertime(2400); // 40 hours
    expect(result.regularHours).toBe(40);
    expect(result.overtimeHours).toBe(0);
  });

  it("should respect custom threshold", () => {
    const result = calculateOvertime(2400, 35); // 40 hours with 35h threshold
    expect(result.overtimeHours).toBeCloseTo(5, 1);
  });
});
