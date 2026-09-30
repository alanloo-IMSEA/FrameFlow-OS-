export type SocialBatchLike = {
  batchNumber?: number | string;
  status?: string;
  [key: string]: any;
};

export function shiftIsoDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date),
    part = (type: string) =>
      parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function socialBatchPlanningWindow(
  startsAt: string,
  today: string,
  leadDays = 6,
) {
  const planningStartsAt = shiftIsoDate(startsAt, -leadDays);
  return {
    planningStartsAt,
    isPlanningOpen: Boolean(
      planningStartsAt && today >= planningStartsAt && today < startsAt,
    ),
    isActive: Boolean(startsAt && today >= startsAt),
  };
}

export function selectSocialBatchLifecycle(input: SocialBatchLike[]) {
  const batches = input
    .slice()
    .sort((a, b) => Number(a.batchNumber) - Number(b.batchNumber));
  const active =
    batches.find((batch) => String(batch.status) === "Active") ||
    batches.find((batch) => String(batch.status) === "Overdue");
  const completed = batches
    .filter((batch) => batch.status === "Completed")
    .at(-1);
  const current =
    active ||
    completed ||
    batches.find((batch) => batch.status !== "Completed") ||
    batches.at(-1) ||
    null;
  const next = current
    ? batches.find(
        (batch) => Number(batch.batchNumber) > Number(current.batchNumber),
      ) || null
    : null;
  return { batches, current, next };
}
