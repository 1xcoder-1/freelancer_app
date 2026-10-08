"use client";

/* eslint-disable react-hooks/exhaustive-deps */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CalendarDays,
  RefreshCw,
  Video,
  Trash2,
  Loader2,
  Unplug,
} from "@/components/animated-icons";

import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import {
  getCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  getGoogleCalendarStatus,
  startGoogleCalendarConnect,
  syncGoogleCalendar,
  disconnectGoogleCalendar,
  type CalendarFeedItem,
  type GoogleConnectionStatus,
} from "@/lib/api";

type ViewKey = "day" | "week" | "month";

// ---------------------------------------------------------------- helpers ----
const DAY_MS = 86_400_000;
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
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const TYPE_STYLE: Record<string, { dot: string; chip: string; label: string }> = {
  meeting: { dot: "bg-accent", chip: "bg-accent/15 text-accent", label: "Meeting" },
  client_work: { dot: "bg-info", chip: "bg-info/15 text-info", label: "Client work" },
  deadline: { dot: "bg-danger", chip: "bg-danger/15 text-danger", label: "Deadline" },
  personal: { dot: "bg-violet", chip: "bg-violet/15 text-violet", label: "Personal" },
};

// ------------------------------------------------------------ component ----
export function DashboardCalendar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { getToken } = useAuth();
  const [view, setView] = useState<ViewKey>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveAt, setLiveAt] = useState<Date | null>(null);
  const [google, setGoogle] = useState<GoogleConnectionStatus | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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
    if (!open) return;
    if (!silent) setLoading(true);
    try {
      const token = (await getToken()) || undefined;
      const data = await getCalendarEvents(toLocalISO(rangeStart), toLocalISO(rangeEnd), token);
      setEvents(data);
      setLiveAt(new Date());
    } catch (err) {
      if (!silent) setNotice(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [open, rangeStart.toISOString(), rangeEnd.toISOString]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // Real-time: live poll while the calendar is open + keep the "now" line fresh
  useEffect(() => {
    if (!open) return;
    const poll = setInterval(() => void loadEvents(true), 45_000);
    const clock = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [open, loadEvents]);

  const loadGoogleStatus = useCallback(async () => {
    try {
      const token = (await getToken()) || undefined;
      setGoogle(await getGoogleCalendarStatus(token));
    } catch {
      setGoogle(null);
    }
  }, []);
  useEffect(() => {
    if (open) void loadGoogleStatus();
  }, [open, loadGoogleStatus]);

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

  const eventsForDay = useCallback(
    (day: Date) =>
      events.filter((e) => {
        const s = parseDT(e.start_time);
        return sameDay(s, day);
      }),
    [events]
  );

  const refreshAfterMutation = () => {
    void loadEvents(true);
  };

  // Escape closes, backdrop click closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (detail) setDetail(null);
        else if (creating) setCreating(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, detail, creating, onClose]);

  if (!open) return null;

  const title =
    view === "month"
      ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
      : view === "week"
        ? `Week of ${MONTHS[cursor.getMonth()].slice(0, 3)} ${cursor.getDate()}, ${cursor.getFullYear()}`
        : `${MONTHS[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`;

  const now = new Date(nowTick);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col animate-in fade-in duration-200">
      {/* Dimmed backdrop (click to close) */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* Calendar surface — dark, full-bleed like the reference */}
      <div className="relative flex-1 flex flex-col bg-card text-fg overflow-hidden m-0 md:m-6 md:rounded-2xl border border-line shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-16 shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg text-muted hover:text-fg hover:bg-surface transition-colors"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(1)}
              className="p-2 rounded-lg border border-line text-fg hover:bg-surface transition-colors"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className="px-3.5 py-1.5 rounded-lg border border-line-strong text-xs font-semibold text-fg hover:bg-surface transition-colors"
            >
              Today
            </button>
            <h2 className="text-base md:text-lg font-bold tracking-tight truncate ml-1">{title}</h2>
            <span className="hidden md:flex items-center gap-1.5 text-[10px] font-mono text-muted ml-1">
              <span className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-warn" : "bg-ok"} ${liveAt ? "animate-pulse" : ""}`} />
              LIVE{liveAt ? ` · ${fmtTime(liveAt)}` : ""}
            </span>
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
                  setNotice(err instanceof Error ? err.message : "Could not start Google connect");
                  setGoogleBusy(false);
                }
              }}
              onSync={async () => {
                setGoogleBusy(true);
                try {
                  const token = (await getToken()) || undefined;
                  const res = await syncGoogleCalendar(token);
                  setNotice(`Synced: ${res.created} new, ${res.updated} updated`);
                  await loadGoogleStatus();
                  refreshAfterMutation();
                } catch (err) {
                  setNotice(err instanceof Error ? err.message : "Google sync failed");
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
                  console.error("Failed to disconnect Google Calendar:", err);
                  toast.error("Could not disconnect Google Calendar");
                } finally {
                  setGoogleBusy(false);
                }
              }}
            />

            {/* Day / Week / Month segmented control (reference style) */}
            <div className="flex items-center rounded-full bg-surface border border-line p-0.5">
              {(["day", "week", "month"] as ViewKey[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                    view === v
                      ? "bg-accent text-accent-fg shadow-sm"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              onClick={() => setCreating(true)}
              className="rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold"
              title="New event"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">New Event</span>
            </Button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted hover:text-fg hover:bg-surface transition-colors"
              title="Close calendar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {notice && (
          <div className="mx-6 mb-2 px-3 py-2 rounded-lg bg-surface border border-line text-xs text-muted flex items-center justify-between gap-3">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-faint hover:text-fg"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col px-3 pb-3 md:px-5 md:pb-5">
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
              onDayDoubleClick={(d) => {
                setSelectedDay(d);
                setCreating(true);
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
              onSlotClick={(d) => {
                setSelectedDay(d);
                setCreating(true);
              }}
            />
          )}
        </div>

        {creating && (
          <NewEventDialog
            day={selectedDay}
            onClose={() => setCreating(false)}
            onCreated={async () => {
              setCreating(false);
              setNotice(null);
              refreshAfterMutation();
            }}
          />
        )}

        {detail && (
          <EventDetail
            item={detail}
            onClose={() => setDetail(null)}
            onDelete={async () => {
              const ok = await confirmDialog({
                title: "Delete event",
                message: "This event will be removed from your calendar.",
                confirmLabel: "Delete",
                danger: true,
              });
              if (!ok) return;
              const token = (await getToken()) || undefined;
              try {
                await deleteCalendarEvent(detail.id, token);
                setDetail(null);
                refreshAfterMutation();
                toast.success("Event deleted");
              } catch (err) {
                setNotice(err instanceof Error ? err.message : "Delete failed");
                toast.error("Could not delete event");
              }
            }}
          />
        )}
      </div>
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
  if (!status) return null;
  if (!status.configured) {
    return (
      <span
        className="hidden lg:inline text-[10px] font-mono text-faint border border-dashed border-line rounded-full px-2.5 py-1"
        title="Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in apps/api/.env to enable Google Calendar"
      >
        Google Calendar: not configured
      </span>
    );
  }
  if (!status.connected) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={onConnect}
        disabled={busy}
        className="rounded-lg border-line-strong text-fg hover:bg-surface gap-1.5"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5 text-accent" />}
        <span className="hidden md:inline">Connect Google Calendar</span>
        <span className="md:hidden">Google</span>
      </Button>
    );
  }
  return (
    <div className="hidden md:flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-2.5 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
      <span className="text-[10px] font-mono text-muted max-w-[140px] truncate" title={status.google_email || ""}>
        {status.google_email || "Google"}
        {status.last_synced_at ? ` · ${fmtTime(parseDT(status.last_synced_at))}` : ""}
      </span>
      <button
        onClick={onSync}
        disabled={busy}
        className="p-1 rounded hover:bg-surface text-muted hover:text-fg transition-colors"
        title="Sync now"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
      </button>
      <button
        onClick={onDisconnect}
        disabled={busy}
        className="p-1 rounded hover:bg-surface text-muted hover:text-danger transition-colors"
        title="Disconnect Google Calendar"
      >
        <Unplug className="w-3.5 h-3.5" />
      </button>
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
  onDayDoubleClick,
  onEventClick,
}: {
  cells: Date[];
  cursor: Date;
  now: Date;
  selectedDay: Date;
  eventsForDay: (d: Date) => CalendarFeedItem[];
  onDayClick: (d: Date) => void;
  onDayDoubleClick: (d: Date) => void;
  onEventClick: (e: CalendarFeedItem) => void;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Weekday header row */}
      <div className="grid grid-cols-7 shrink-0">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-3 text-center text-[11px] font-semibold tracking-[0.15em] text-muted">
            {w}
          </div>
        ))}
      </div>

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
              onDoubleClick={() => onDayDoubleClick(d)}
              className={`relative border-r border-b border-line p-1.5 min-h-[72px] md:min-h-[96px] cursor-pointer transition-colors ${
                isSelected ? "bg-accent/[0.06] ring-1 ring-inset ring-accent/60" : "hover:bg-surface/60"
              }`}
            >
              <div className="flex justify-center pt-1">
                <span
                  className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold ${
                    isToday
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
                  const style = TYPE_STYLE[e.event_type] || TYPE_STYLE.personal;
                  return (
                    <button
                      key={`${e.source}-${e.id}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e);
                      }}
                      className={`w-full text-left px-1.5 py-0.5 rounded-md text-[10px] md:text-[11px] font-medium truncate transition-opacity hover:opacity-80 flex items-center gap-1.5 ${style.chip}`}
                      title={`${e.title}${e.client_name ? ` — ${e.client_name}` : ""}`}
                    >
                      <span className={`w-1 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                      <span className="truncate">
                        {e.is_all_day ? "" : `${fmtTime(parseDT(e.start_time))} `}
                        {e.title}
                      </span>
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-faint font-mono pl-1.5">
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
  onSlotClick,
}: {
  days: Date[];
  now: Date;
  events: CalendarFeedItem[];
  onEventClick: (e: CalendarFeedItem) => void;
  onSlotClick: (d: Date) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Open around 8am-ish instead of midnight
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_H;
  }, [days.length]);

  return (
    <div className="flex-1 flex flex-col min-h-0 border border-line rounded-xl overflow-hidden bg-card">
      {/* Day headers */}
      <div className="grid shrink-0 border-b border-line" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div />
        {days.map((d, i) => (
          <div key={i} className="py-2.5 text-center">
            <div className="text-[10px] font-semibold tracking-widest text-muted">{WEEKDAYS[d.getDay()]}</div>
            <div
              className={`mx-auto mt-1 w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold ${
                sameDay(d, now) ? "bg-accent text-accent-fg" : "text-fg"
              }`}
            >
              {d.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable hour grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
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
            const dayEvents = events.filter((e) => sameDay(parseDT(e.start_time), day));
            return (
              <div
                key={di}
                className="relative border-r border-line last:border-r-0"
                onDoubleClick={() => onSlotClick(day)}
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
                    const style = TYPE_STYLE[e.event_type] || TYPE_STYLE.personal;
                    return (
                      <button
                        key={`${e.source}-${e.id}`}
                        onClick={() => onEventClick(e)}
                        className={`absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 text-left text-[10px] font-medium border-l-2 overflow-hidden hover:opacity-90 transition-opacity ${style.chip}`}
                        style={{
                          top: startH * HOUR_H + 1,
                          height: Math.min(durH * HOUR_H - 2, 6 * HOUR_H),
                          borderColor: "currentColor",
                        }}
                        title={e.title}
                      >
                        <div className="truncate font-semibold">{e.title}</div>
                        <div className="truncate opacity-80">
                          {fmtTime(s)}{e.client_name ? ` · ${e.client_name}` : ""}
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

// ------------------------------------------------------- new event form ----
function NewEventDialog({
  day,
  onClose,
  onCreated,
}: {
  day: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { getToken } = useAuth();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("meeting");
  const [clientName, setClientName] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startStr, setStartStr] = useState(() => {
    const d = new Date(day);
    d.setHours(Math.min(18, Math.max(9, d.getHours() + 1)), 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [durationMin, setDurationMin] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError("Give the event a title");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const start = new Date(startStr);
      const token = (await getToken()) || undefined;
      await createCalendarEvent(
        {
          title: title.trim(),
          event_type: type,
          client_name: clientName.trim() || undefined,
          is_all_day: allDay,
          start_time: toLocalISO(start),
          end_time: toLocalISO(allDay ? start : new Date(start.getTime() + durationMin * 60_000)),
        },
        token
      );
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[90] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-md bg-card border border-line rounded-2xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-fg">New Event</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title — e.g. Client sync with Acme"
            className="w-full px-3 py-2 rounded-lg bg-surface border border-line text-sm text-fg placeholder:text-faint focus:outline-none focus:border-accent"
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted space-y-1">
              <span>Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-surface border border-line text-sm text-fg focus:outline-none focus:border-accent"
              >
                <option value="meeting">Meeting</option>
                <option value="client_work">Client work block</option>
                <option value="deadline">Deadline</option>
                <option value="personal">Personal</option>
              </select>
            </label>
            <label className="text-xs text-muted space-y-1">
              <span>Client (optional)</span>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Acme Inc."
                className="w-full px-2.5 py-2 rounded-lg bg-surface border border-line text-sm text-fg placeholder:text-faint focus:outline-none focus:border-accent"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted space-y-1">
              <span>Starts</span>
              <input
                type="datetime-local"
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-surface border border-line text-sm text-fg focus:outline-none focus:border-accent"
              />
            </label>
            <label className="text-xs text-muted space-y-1">
              <span>Duration (min)</span>
              <input
                type="number"
                min={15}
                step={15}
                value={durationMin}
                disabled={allDay}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-lg bg-surface border border-line text-sm text-fg disabled:opacity-50 focus:outline-none focus:border-accent"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-[var(--accent)]" />
            All-day event
          </label>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} className="rounded-lg border-line text-fg">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submit}
              disabled={saving}
              className="rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Save Event
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------ event detail card ----
function EventDetail({
  item,
  onClose,
  onDelete,
}: {
  item: CalendarFeedItem;
  onClose: () => void;
  onDelete: () => void;
}) {
  const style = TYPE_STYLE[item.event_type] || TYPE_STYLE.personal;
  const s = parseDT(item.start_time);
  const en = parseDT(item.end_time);
  const deletable = item.source === "local";

  return (
    <div className="absolute inset-0 z-[90] flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-sm bg-card border border-line rounded-2xl p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold font-mono uppercase tracking-wide px-2 py-0.5 rounded-full ${style.chip}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {style.label}
              {item.source !== "local" ? ` · ${item.source}` : ""}
            </span>
            <h3 className="font-bold text-fg mt-2">{item.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface"><X className="w-4 h-4" /></button>
        </div>

        <div className="mt-3 space-y-1.5 text-xs text-muted">
          <p className="font-mono text-fg">
            {s.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
            {" · "}
            {item.is_all_day ? "All day" : `${fmtTime(s)} – ${fmtTime(en)}`}
          </p>
          {item.client_name && <p>Client: <span className="text-fg">{item.client_name}</span></p>}
          {item.status && <p>Status: <span className="text-fg capitalize">{item.status}</span></p>}
          {item.description && <p className="pt-1 leading-relaxed">{item.description}</p>}
        </div>

        {item.meeting_link && (
          <a
            href={item.meeting_link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-accent hover:text-accent-hi"
          >
            <Video className="w-3.5 h-3.5" />
            Join meeting
          </a>
        )}

        {deletable && (
          <button
            onClick={onDelete}
            className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-danger hover:opacity-80"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete event
          </button>
        )}
      </div>
    </div>
  );
}
