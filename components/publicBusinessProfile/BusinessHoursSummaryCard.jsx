"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import {
  formatHoursValue,
  formatTime,
  toObject,
} from "@/lib/business/profileUtils";

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function getHoursState(hoursJson) {
  const hours = toObject(hoursJson);
  const hasHours = hours && typeof hours === "object" && Object.keys(hours).length > 0;
  if (!hasHours) {
    return {
      hasHours: false,
      statusLabel: "Hours unavailable",
      statusTone: "text-slate-500",
      todayLabel: "Today: Not listed",
      weeklyHours: [],
    };
  }

  const weekdayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const now = new Date();
  const todayKey = weekdayMap[now.getDay()];
  const today = hours?.[todayKey];
  const todayDay = DAYS.find((day) => day.key === todayKey);
  const todayValue = formatHoursValue(today);
  const weeklyHours = DAYS.map((day) => ({
    ...day,
    value: formatHoursValue(hours?.[day.key]) || "Closed",
  }));

  if (!today || typeof today !== "object") {
    return {
      hasHours: true,
      statusLabel: "Hours listed",
      statusTone: "text-slate-600",
      todayLabel: `Today: ${todayValue || "Not listed"}`,
      weeklyHours,
    };
  }

  if (today.isClosed) {
    return {
      hasHours: true,
      statusLabel: "Closed now",
      statusTone: "text-slate-500",
      todayLabel: `Today: ${todayDay?.label || "Today"} closed`,
      weeklyHours,
    };
  }

  if (!(today.open && today.close)) {
    return {
      hasHours: true,
      statusLabel: "Hours listed",
      statusTone: "text-slate-600",
      todayLabel: `Today: ${todayValue || "Not listed"}`,
      weeklyHours,
    };
  }

  const [openHour = 0, openMinute = 0] = String(today.open)
    .split(":")
    .map((value) => Number(value));
  const [closeHour = 0, closeMinute = 0] = String(today.close)
    .split(":")
    .map((value) => Number(value));

  if (
    [openHour, openMinute, closeHour, closeMinute].some((value) =>
      Number.isNaN(value)
    )
  ) {
    return {
      hasHours: true,
      statusLabel: "Hours listed",
      statusTone: "text-slate-600",
      todayLabel: `Today: ${todayValue || "Not listed"}`,
      weeklyHours,
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;
  const isOpen =
    closeMinutes >= openMinutes
      ? currentMinutes >= openMinutes && currentMinutes <= closeMinutes
      : currentMinutes >= openMinutes || currentMinutes <= closeMinutes;

  return {
    hasHours: true,
    statusLabel: isOpen ? "Open now" : "Closed now",
    statusTone: isOpen ? "text-emerald-600" : "text-slate-500",
    todayLabel: `Today: ${formatTime(today.open)} - ${formatTime(today.close)}`,
    weeklyHours,
  };
}

export default function BusinessHoursSummaryCard({ hoursJson }) {
  const [expanded, setExpanded] = useState(false);
  const hoursState = useMemo(() => getHoursState(hoursJson), [hoursJson]);

  return (
    <div className="rounded-[16px] border border-slate-100 bg-white px-3.5 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-slate-50 p-2 text-[#6a3df0]">
          <Clock className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Hours
              </p>
              <p className={`mt-1 text-sm font-medium ${hoursState.statusTone}`}>
                {hoursState.statusLabel}
              </p>
              <p className="mt-1 text-sm text-slate-600">{hoursState.todayLabel}</p>
            </div>
            {hoursState.hasHours ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[#5b37d6] transition hover:bg-[#f6f1ff]"
              >
                {expanded ? "Hide hours" : "View full hours"}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            ) : null}
          </div>

          {expanded ? (
            <div className="mt-3 space-y-2">
              {hoursState.weeklyHours.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between gap-4 rounded-[12px] bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-700">{entry.label}</span>
                  <span className="text-slate-500">{entry.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
