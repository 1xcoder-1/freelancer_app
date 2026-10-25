"use client";

/* eslint-disable react-hooks/exhaustive-deps */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  CalendarDays,
  RefreshCw,
  Video,
  Trash2,
  Loader2,
  Unplug,
} from "@/components/animated-icons";

import { Button } from "@/components/ui/button";
import { CalendarSkeleton } from "./CalendarSkeleton";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { CalendarEventDetailModal } from "./CalendarEventModals";
import {
  getCalendarEvents,
  deleteCalendarEvent,
  getGoogleCalendarStatus,
  startGoogleCalendarConnect,
  syncGoogleCalendar,
  disconnectGoogleCalendar,
  type CalendarFeedItem,
  type GoogleConnectionStatus,
} from "@/lib/api";
import { logHandledError } from "@/lib/log-error";
import { humanizeCalendarTitle } from "@/lib/humanize";

type ViewKey = "day" | "week" | "month";

// ---------------------------------------------------------------- helpers ----
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Parse a naive backend datetime string as LOCAL time (app-wide convention). */
function parseDT(s: string): Date {
  return new Date(s);
}
function toLocalISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export interface EventStyle {
  label: string;
  dot: string;
  chip: string;
  timeGridBg: string;
  badge: string;
  titleColor: string;
  timeColor: string;
}

const TYPE_STYLE: Record<string, EventStyle> = {
  meeting: {
    label: "Meeting",
    dot: "bg-sky-500 dark:bg-sky-400",
    chip: "bg-sky-500/10 hover:bg-sky-500/15 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 border border-sky-500/20 dark:border-sky-500/30 border-l-[3px] border-l-sky-500 dark:border-l-sky-400 shadow-xs",
    timeGridBg: "bg-sky-500/10 hover:bg-sky-500/15 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 border border-sky-500/20 dark:border-sky-500/30 border-l-[3px] border-l-sky-500 dark:border-l-sky-400 shadow-xs backdrop-blur-xs",
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25",
    titleColor: "text-sky-950 dark:text-sky-100",
    timeColor: "text-sky-700/85 dark:text-sky-300/85",
  },
  client_work: {
    label: "Client work",
    dot: "bg-emerald-500 dark:bg-emerald-400",
    chip: "bg-emerald-500/10 hover:bg-emerald-500/15 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-emerald-500/20 dark:border-emerald-500/30 border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400 shadow-xs",
    timeGridBg: "bg-emerald-500/10 hover:bg-emerald-500/15 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-emerald-500/20 dark:border-emerald-500/30 border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400 shadow-xs backdrop-blur-xs",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25",
    titleColor: "text-emerald-950 dark:text-emerald-100",
    timeColor: "text-emerald-700/85 dark:text-emerald-300/85",
  },
  deadline: {
    label: "Deadline",
    dot: "bg-rose-500 dark:bg-rose-400",
    chip: "bg-rose-500/10 hover:bg-rose-500/15 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 border border-rose-500/20 dark:border-rose-500/30 border-l-[3px] border-l-rose-500 dark:border-l-rose-400 shadow-xs",
    timeGridBg: "bg-rose-500/10 hover:bg-rose-500/15 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 border border-rose-500/20 dark:border-rose-500/30 border-l-[3px] border-l-rose-500 dark:border-l-rose-400 shadow-xs backdrop-blur-xs",
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25",
    titleColor: "text-rose-950 dark:text-rose-100",
    timeColor: "text-rose-700/85 dark:text-rose-300/85",
  },
  personal: {
    label: "Personal",
    dot: "bg-purple-500 dark:bg-purple-400",
    chip: "bg-purple-500/10 hover:bg-purple-500/15 dark:bg-purple-500/15 dark:hover:bg-purple-500/25 border border-purple-500/20 dark:border-purple-500/30 border-l-[3px] border-l-purple-500 dark:border-l-purple-400 shadow-xs",
    timeGridBg: "bg-purple-500/10 hover:bg-purple-500/15 dark:bg-purple-500/15 dark:hover:bg-purple-500/25 border border-purple-500/20 dark:border-purple-500/30 border-l-[3px] border-l-purple-500 dark:border-l-purple-400 shadow-xs backdrop-blur-xs",
    badge: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25",
    titleColor: "text-purple-950 dark:text-purple-100",
    timeColor: "text-purple-700/85 dark:text-purple-300/85",
  },
};

function getEventStyle(e: CalendarFeedItem): EventStyle {
  if (e.source === "invoice") {
    return {
      label: "Invoice",
      dot: "bg-amber-500 dark:bg-amber-400",
      chip: "bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-500/20 dark:border-amber-500/30 border-l-[3px] border-l-amber-500 dark:border-l-amber-400 shadow-xs",
      timeGridBg: "bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-500/20 dark:border-amber-500/30 border-l-[3px] border-l-amber-500 dark:border-l-amber-400 shadow-xs backdrop-blur-xs",
      badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25",
      titleColor: "text-amber-950 dark:text-amber-100",
      timeColor: "text-amber-700/85 dark:text-amber-300/85",
    };
  }
  return TYPE_STYLE[e.event_type] || TYPE_STYLE.meeting;
}

// ------------------------------------------------------------ component ----
export function DashboardCalendar() {
  const { getToken } = useAuth();
  const [view, setView] = useState<ViewKey>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [liveAt, setLiveAt] = useState<Date | null>(null);
  const [google, setGoogle] = useState<GoogleConnectionStatus | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [detail, setDetail] = useState<CalendarFeedItem | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Display range for the current view — also the API query window
  const { rangeStart, rangeEnd, cells } = useMemo(() => {
    const dayStart = startOfDay(cursor);
    if (view === "month") {
      const first = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1);
      const last = new Date(dayStart.getFullYear(), dayStart.getMonth() + 1, 0);
      const gridStart = addDays(first, -first.getDay());
      const gridEnd = addDays(last, 6 - last.getDay());
      const cellsArr: Date[] = [];
      for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) cellsArr.push(new Date(d));
      return { rangeStart: gridStart, rangeEnd: addDays(gridEnd, 1), cells: cellsArr };
    }
    if (view === "week") {
      const gridStart = addDays(dayStart, -dayStart.getDay());
      const cellsArr: Date[] = [];
      for (let i = 0; i < 7; i++) cellsArr.push(addDays(gridStart, i));
      return { rangeStart: gridStart, rangeEnd: addDays(gridStart, 7), cells: cellsArr };
    }
    return { rangeStart: dayStart, rangeEnd: addDays(dayStart, 1), cells: [dayStart] };
  }, [view, cursor]);

  const loadEvents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = (await getToken()) || undefined;
      const data = await getCalendarEvents(toLocalISO(rangeStart), toLocalISO(rangeEnd), token);
      setEvents(data);
      setLiveAt(new Date());
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  }, [rangeStart.toISOString(), rangeEnd.toISOString()]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // Real-time: live poll while the calendar is open + keep the "now" line fresh.
  // Both pause while the tab is hidden — background tabs don't need either.
  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void loadEvents(true);
    }, 45_000);
    const clock = setInterval(() => {
      if (document.visibilityState === "visible") setNowTick(Date.now());
    }, 60_000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [loadEvents]);

  const loadGoogleStatus = useCallback(async () => {
    try {
      const token = (await getToken()) || undefined;
      setGoogle(await getGoogleCalendarStatus(token));
    } catch {
      setGoogle(null);
    }
  }, []);
  useEffect(() => {
    void loadGoogleStatus();
  }, [loadGoogleStatus]);

  const navigate = (dir: -1 | 1) => {
    if (view === "month") setCursor((c) => addMonths(c, dir));
    else if (view === "week") setCursor((c) => addDays(c, dir * 7));
    else setCursor((c) => addDays(c, dir));
  };

  const goToday = () => {
    const now = new Date();
    setCursor(now);
    setSelectedDay(now);
  };

  // Index events by local calendar day once per fetch: the month grid asks
  // eventsForDay for all 42 cells on every render, so per-cell full-list
  // filters (O(cells x events)) would compound with the 60s clock tick.
  const eventsByDay = useMemo(() => {
    const byDay = new Map<string, typeof events>();
    for (const e of events) {
      const d = parseDT(e.start_time);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = byDay.get(key);
      if (list) list.push(e);
      else byDay.set(key, [e]);
    }
    return byDay;
  }, [events]);

  const eventsForDay = useCallback(
    (day: Date) => {
      const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
      return eventsByDay.get(key) ?? [];
    },
    [eventsByDay]
  );

  const refreshAfterMutation = () => {
    void loadEvents(true);
  };

  // Escape backs out of the detail modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detail) setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  const title = useMemo(() => {
    if (view === "month") {
      return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    }
    if (view === "week") {
      const weekStart = cells[0];
      const weekEnd = cells[cells.length - 1];
      if (weekStart && weekEnd) {
        if (weekStart.getMonth() === weekEnd.getMonth()) {
          return `${MONTHS[weekStart.getMonth()].slice(0, 3)} ${weekStart.getDate()}–${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
        }
        return `${MONTHS[weekStart.getMonth()].slice(0, 3)} ${weekStart.getDate()} – ${MONTHS[weekEnd.getMonth()].slice(0, 3)} ${weekEnd.getDate()}`;
      }
      return `${MONTHS[cursor.getMonth()].slice(0, 3)} ${cursor.getDate()}, ${cursor.getFullYear()}`;
    }
    return `${MONTHS[cursor.getMonth()].slice(0, 3)} ${cursor.getDate()}, ${cursor.getFullYear()}`;
  }, [view, cursor, cells]);

  const now = new Date(nowTick);

  if (!initialLoaded && events.length === 0) {
    return <CalendarSkeleton />;
  }

  return (
    <div className="relative flex flex-col h-[calc(100vh-8rem)] min-h-[520px] bg-card text-fg overflow-hidden rounded-2xl border border-line">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-14 shrink-0 border-b border-line/40">
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Unified Previous / Next buttons */}
          <div className="inline-flex items-center h-8 rounded-lg border border-line bg-surface/60 p-0.5 shadow-xs shrink-0">
            <button
              onClick={() => navigate(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-surface transition-all active:scale-95 cursor-pointer"
              title="Previous"
              aria-label="Previous"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => navigate(1)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-surface transition-all active:scale-95 cursor-pointer"
              title="Next"
              aria-label="Next"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={goToday}
            className="inline-flex items-center justify-center h-8 px-2.5 rounded-lg border border-line bg-surface/60 hover:bg-surface text-xs font-semibold text-fg shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
          >
            Today
          </button>

          <div className="flex items-center h-8 pl-1">
            <h2 className="text-base font-bold tracking-tight text-fg shrink-0 whitespace-nowrap">
              {title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <GoogleBar
            status={google}
            busy={googleBusy}
            onConnect={async () => {
              setGoogleBusy(true);
              try {
                const token = (await getToken()) || undefined;
                const { auth_url } = await startGoogleCalendarConnect(token);
                window.location.href = auth_url;
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not start Google connect");
                setGoogleBusy(false);
              }
            }}
            onSync={async () => {
              setGoogleBusy(true);
              try {
                const token = (await getToken()) || undefined;
                const res = await syncGoogleCalendar(token);
                toast.success(`Synced: ${res.created} new, ${res.updated} updated`);
                await loadGoogleStatus();
                refreshAfterMutation();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Google sync failed");
              } finally {
                setGoogleBusy(false);
              }
            }}
            onDisconnect={async () => {
              const ok = await confirmDialog({
                title: "Disconnect Google Calendar",
                message: "Your Google meetings will stop appearing here. You can reconnect any time.",
                confirmLabel: "Disconnect",
                danger: true,
              });
              if (!ok) return;
              setGoogleBusy(true);
              try {
                const token = (await getToken()) || undefined;
                await disconnectGoogleCalendar(token);
                await loadGoogleStatus();
                refreshAfterMutation();
                toast.success("Google Calendar disconnected");
              } catch (err) {
                logHandledError("Failed to disconnect Google Calendar:", err);
                toast.error("Could not disconnect Google Calendar");
              } finally {
                setGoogleBusy(false);
              }
            }}
          />

          {/* Day / Week / Month segmented switcher */}
          <div className="inline-flex items-center h-8 p-0.5 rounded-lg bg-surface/90 border border-line-strong shadow-xs shrink-0 gap-0.5">
            {(["day", "week", "month"] as ViewKey[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`h-7 px-2.5 rounded-md text-xs capitalize transition-all select-none cursor-pointer flex items-center justify-center font-medium ${view === v
                    ? "bg-card text-fg font-bold shadow-xs border border-line/80 ring-1 ring-white/5"
                    : "text-muted hover:text-fg hover:bg-surface/80"
                  }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col px-3 pb-3 md:px-5 md:pb-5">
        {view === "month" && (
          <MonthView
            cells={cells}
            cursor={cursor}
            now={now}
            selectedDay={selectedDay}
            eventsForDay={eventsForDay}
            onDayClick={(d) => {
              setSelectedDay(d);
              setCursor(d);
            }}
            onEventClick={setDetail}
          />
        )}
        {(view === "week" || view === "day") && (
          <TimeGrid
            days={view === "week" ? cells : [startOfDay(cursor)]}
            now={now}
            events={events}
            onEventClick={setDetail}
          />
        )}
      </div>

      {detail && (
        <CalendarEventDetailModal
          item={detail}
          onClose={() => setDetail(null)}
          onDeleted={async () => {
            setDetail(null);
            refreshAfterMutation();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------- google bar ----
function GoogleBar({
  status,
  busy,
  onConnect,
  onSync,
  onDisconnect,
}: {
  status: GoogleConnectionStatus | null;
  busy: boolean;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!status) return null;
  if (!status.configured) {
    return (
      <span
        className="hidden xl:inline text-[10px] font-mono text-faint border border-line/60 rounded-md px-2 py-1"
        title="Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in apps/api/.env to enable Google Calendar"
      >
        Google: unconfigured
      </span>
    );
  }
  if (!status.connected) {
    return (
      <button
        onClick={onConnect}
        disabled={busy}
        title="Connect Google Calendar"
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-line bg-surface/60 hover:bg-surface text-xs font-semibold text-fg shadow-xs transition-all active:scale-95 cursor-pointer shrink-0 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <CalendarDays className="w-3.5 h-3.5 text-accent" />
        )}
        <span>Google</span>
      </button>
    );
  }

  const syncLabel = status.last_synced_at
    ? `Synced ${fmtTime(parseDT(status.last_synced_at))}`
    : "Connected";

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((prev) => !prev)}
        disabled={busy}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-line bg-surface/60 hover:bg-surface text-xs font-semibold text-fg shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
        title={`Google Calendar connected (${status.google_email || ""}) — click for options`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {busy ? (
          <Loader2 className="w-3 h-3 text-accent animate-spin shrink-0" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)] shrink-0" />
        )}
        <span>Google</span>
        <ChevronDown className={`w-3 h-3 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl bg-card border border-line p-1.5 shadow-xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2.5 py-2 border-b border-line/60">
            <div className="flex items-center gap-1.5 text-fg font-semibold truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{status.google_email || "Google Calendar"}</span>
            </div>
            <p className="text-[11px] text-muted font-mono mt-0.5">{syncLabel}</p>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                setOpen(false);
                onSync();
              }}
              disabled={busy}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-fg hover:bg-surface transition-colors cursor-pointer text-left font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-muted ${busy ? "animate-spin" : ""}`} />
              <span>Sync events now</span>
            </button>

            <button
              onClick={() => {
                setOpen(false);
                onDisconnect();
              }}
              disabled={busy}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors cursor-pointer text-left font-medium disabled:opacity-50"
            >
              <Unplug className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------- month view ----
function MonthView({
  cells,
  cursor,
  now,
  selectedDay,
  eventsForDay,
  onDayClick,
  onEventClick,
}: {
  cells: Date[];
  cursor: Date;
  now: Date;
  selectedDay: Date;
  eventsForDay: (d: Date) => CalendarFeedItem[];
  onDayClick: (d: Date) => void;
  onEventClick: (e: CalendarFeedItem) => void;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-[640px] pt-3">
      {/* Day cells */}
      <div className="grid grid-cols-7 flex-1 min-h-0 border-t border-l border-line rounded-xl overflow-hidden">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, now);
          const isSelected = sameDay(d, selectedDay);
          const dayEvents = eventsForDay(d);
          return (
            <div
              key={i}
              onClick={() => onDayClick(d)}
              className={`relative border-r border-b border-line p-1.5 min-h-[72px] md:min-h-[96px] cursor-pointer transition-colors ${isSelected ? "bg-accent/[0.06] ring-1 ring-inset ring-accent/60" : "hover:bg-surface/60"
                }`}
            >
              <div className="flex justify-center pt-1">
                <span
                  className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold ${isToday
                      ? "bg-accent text-accent-fg"
                      : inMonth
                        ? "text-fg"
                        : "text-faint"
                    }`}
                >
                  {d.getDate()}
                </span>
              </div>

              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map((e) => {
                  const style = getEventStyle(e);
                  return (
                    <button
                      key={`${e.source}-${e.id}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e);
                      }}
                      className={`w-full text-left px-1.5 py-1 rounded-[5px] text-[10px] md:text-[11px] font-medium truncate transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer ${style.chip}`}
                      title={`${humanizeCalendarTitle(e.title)}${e.client_name ? ` — ${e.client_name}` : ""}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot} shadow-xs`} />
                      {!e.is_all_day && (
                        <span className={`shrink-0 font-semibold text-[9px] md:text-[10px] tracking-tight ${style.timeColor}`}>
                          {fmtTime(parseDT(e.start_time))}
                        </span>
                      )}
                      <span className={`truncate font-medium ${style.titleColor}`}>{humanizeCalendarTitle(e.title)}</span>
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-faint font-medium pl-1.5">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------- time grid ----
const HOUR_H = 48; // px per hour row

function TimeGrid({
  days,
  now,
  events,
  onEventClick,
}: {
  days: Date[];
  now: Date;
  events: CalendarFeedItem[];
  onEventClick: (e: CalendarFeedItem) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Index events by local calendar day once per fetch (see eventsByDay in the
  // parent) — the grid used to filter the full event list for every column.
  const eventsByDay = useMemo(() => {
    const byDay = new Map<string, CalendarFeedItem[]>();
    for (const e of events) {
      const d = parseDT(e.start_time);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = byDay.get(key);
      if (list) list.push(e);
      else byDay.set(key, [e]);
    }
    return byDay;
  }, [events]);

  useEffect(() => {
    // Open around 8am-ish instead of midnight
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_H;
  }, [days.length]);

  return (
    <div className="flex-1 flex flex-col min-h-[420px] border border-line rounded-xl overflow-hidden bg-card">
      {/* Day headers */}
      <div className="grid shrink-0 border-b border-line bg-card" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div />
        {days.map((d, i) => {
          const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const allDayList = (eventsByDay.get(dayKey) ?? []).filter((e) => e.is_all_day);
          return (
            <div key={i} className="py-2.5 px-1 text-center border-r border-line last:border-r-0">
              <div className="text-[10px] font-semibold tracking-widest text-muted">{WEEKDAYS[d.getDay()]}</div>
              <div
                className={`mx-auto mt-1 w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold ${sameDay(d, now) ? "bg-accent text-accent-fg" : "text-fg"
                  }`}
              >
                {d.getDate()}
              </div>
              {allDayList.length > 0 && (
                <div className="mt-1.5 space-y-1 text-left">
                  {allDayList.map((e) => {
                    const style = getEventStyle(e);
                    return (
                      <button
                        key={`${e.source}-${e.id}`}
                        onClick={() => onEventClick(e)}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate shadow-xs block ${style.chip}`}
                        title={humanizeCalendarTitle(e.title)}
                      >
                        <span className={style.titleColor}>{humanizeCalendarTitle(e.title)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable hour grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar relative">
        <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, height: 24 * HOUR_H }}>
          {/* Gutter */}
          <div className="relative border-r border-line">
            {hours.map((h) => (
              <div key={h} className="absolute w-full -translate-y-1/2 pr-2 text-right text-[10px] font-mono text-faint" style={{ top: h * HOUR_H }}>
                {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {days.map((day, di) => {
            const dayKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const dayEvents = eventsByDay.get(dayKey) ?? [];
            return (
              <div
                key={di}
                className="relative border-r border-line last:border-r-0"
              >
                {hours.map((h) => (
                  <div key={h} className="absolute w-full border-t border-line/60" style={{ top: h * HOUR_H }} />
                ))}

                {/* Now line */}
                {sameDay(day, now) && (
                  <div
                    className="absolute left-0 right-0 h-px bg-accent z-10"
                    style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_H }}
                  >
                    <span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-accent" />
                  </div>
                )}

                {dayEvents
                  .filter((e) => !e.is_all_day)
                  .map((e) => {
                    const s = parseDT(e.start_time);
                    const en = parseDT(e.end_time);
                    const startH = s.getHours() + s.getMinutes() / 60;
                    const durH = Math.max(0.5, (en.getTime() - s.getTime()) / (60 * 60 * 1000));
                    const style = getEventStyle(e);
                    return (
                      <button
                        key={`${e.source}-${e.id}`}
                        onClick={() => onEventClick(e)}
                        className={`absolute left-0.5 right-0.5 rounded-md px-2 py-1 text-left overflow-hidden active:scale-[0.99] transition-all cursor-pointer z-20 ${style.timeGridBg}`}
                        style={{
                          top: startH * HOUR_H + 1,
                          height: Math.max(26, Math.min(durH * HOUR_H - 2, 6 * HOUR_H)),
                        }}
                        title={humanizeCalendarTitle(e.title)}
                      >
                        <div className={`truncate font-semibold text-xs leading-tight ${style.titleColor}`}>{humanizeCalendarTitle(e.title)}</div>
                        <div className={`truncate text-[10px] leading-tight mt-0.5 font-normal ${style.timeColor}`}>
                          {fmtTime(s)}{durH > 0.6 ? ` – ${fmtTime(en)}` : ""}{e.client_name ? ` · ${e.client_name}` : ""}
                        </div>
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


