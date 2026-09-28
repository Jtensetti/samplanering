export const teamToday = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: process.env.TIME_ZONE || "Europe/Stockholm",
  }).format(new Date());
export function nextDate(value, repeat) {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  if (repeat === "weekly") dt.setUTCDate(d + 7);
  else if (repeat === "monthly") {
    dt.setUTCDate(1);
    dt.setUTCMonth(m);
    const last = new Date(
      Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0),
    ).getUTCDate();
    dt.setUTCDate(Math.min(d, last));
  }
  return dt.toISOString().slice(0, 10);
}
