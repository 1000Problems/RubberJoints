// All date logic uses Pacific timezone to match the original app

export function todayPacificStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

export function todayPacific(): Date {
  return new Date(todayPacificStr() + "T00:00:00Z");
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
