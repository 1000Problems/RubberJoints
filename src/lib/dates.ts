// All date logic uses Pacific timezone to match the original app
const TZ = "America/Los_Angeles";

export function todayPacific(): Date {
  const now = new Date();
  const pacific = new Date(
    now.toLocaleString("en-US", { timeZone: TZ })
  );
  pacific.setHours(0, 0, 0, 0);
  return pacific;
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
