import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Shield,
  ShieldAlert,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface LiveFeedNotification {
  id: string;
  title: string;
  detail?: string;
  level: "danger" | "warning" | "info" | "success";
  timestamp: number;
  read: boolean;
}

interface HeaderProps {
  analyzedCount: number;
  casesResolved: number;
  casesEscalated: number;
  avgResponseSeconds: number;
  sessionStartTimestamp: number;
  connectionStatus: "checking" | "live" | "reconnecting";
  isPollingLatest: boolean;
  metricsBarVisible: boolean;
  notifications: LiveFeedNotification[];
  unreadNotificationCount: number;
  escapeSignal: number;
  onToggleMetricsBar: () => void;
  onRetryConnection: () => void;
  onOpenNotifications: () => void;
}

function notificationIcon(level: LiveFeedNotification["level"]) {
  if (level === "danger") {
    return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />;
  }
  if (level === "warning") {
    return <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />;
  }
  if (level === "success") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  }
  return <Activity className="h-3.5 w-3.5 text-cyan-400" />;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function Header({
  analyzedCount,
  casesResolved,
  casesEscalated,
  avgResponseSeconds,
  sessionStartTimestamp,
  connectionStatus,
  isPollingLatest,
  metricsBarVisible,
  notifications,
  unreadNotificationCount,
  escapeSignal,
  onToggleMetricsBar,
  onRetryConnection,
  onOpenNotifications,
}: HeaderProps) {
  const [time, setTime] = useState<string>("");
  const [sessionDuration, setSessionDuration] = useState<string>("00:00:00");
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);

  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const updateDuration = () => {
      const elapsedSec = Math.max(0, Math.floor((Date.now() - sessionStartTimestamp) / 1000));
      const hh = String(Math.floor(elapsedSec / 3600)).padStart(2, "0");
      const mm = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, "0");
      const ss = String(elapsedSec % 60).padStart(2, "0");
      setSessionDuration(`${hh}:${mm}:${ss}`);
    };

    updateDuration();
    const id = window.setInterval(updateDuration, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [sessionStartTimestamp]);

  useEffect(() => {
    if (notificationDrawerOpen) {
      onOpenNotifications();
    }
  }, [notificationDrawerOpen, onOpenNotifications]);

  useEffect(() => {
    setNotificationDrawerOpen(false);
  }, [escapeSignal]);

  const isLive = connectionStatus === "live";
  const isReconnecting = connectionStatus === "reconnecting";

  const shiftStart = useMemo(
    () =>
      new Date(sessionStartTimestamp).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [sessionStartTimestamp],
  );

  return (
    <header className="relative h-11 border-b border-border bg-card/40 backdrop-blur supports-[backdrop-filter]:bg-card/30">
      <div className="flex h-full items-center justify-between gap-3 px-3 lg:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/30">
            <Shield className="h-5 w-5 text-primary" strokeWidth={2.25} />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-safe animate-pulse-dot" />
          </div>
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-[12px] font-semibold tracking-tight text-foreground sm:text-[13px]">
              TruPay <span className="text-muted-foreground">- Security Command Center</span>
            </h1>
            <p className="hidden truncate font-mono text-[10px] text-muted-foreground xl:block">v2.4.1 · UPI Fraud Flow Modeller · session {time}</p>
          </div>
        </div>

        <div className="dashboard-nav-items">
          <div className="relative flex shrink-0 items-center gap-2 overflow-hidden rounded-full border border-border bg-secondary/60 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isLive
                    ? "bg-safe animate-ping"
                    : isReconnecting
                      ? "bg-danger animate-ping"
                      : "bg-warn animate-ping"
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  isLive ? "bg-safe" : isReconnecting ? "bg-danger" : "bg-warn"
                }`}
              />
            </span>
            <span className="text-xs font-medium text-foreground">
              {isLive ? "Live" : isReconnecting ? "Reconnecting..." : "Checking..."}
            </span>
            <Wifi className="h-3 w-3 text-muted-foreground" />
          </div>

          <Button variant="outline" size="sm" onClick={onToggleMetricsBar} className="h-8 shrink-0 text-xs">
            {metricsBarVisible ? "Hide Model Health" : "Show Model Health"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onRetryConnection}
            disabled={connectionStatus === "checking"}
            className="h-8 shrink-0 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${connectionStatus === "checking" ? "animate-spin" : ""}`} />
            {connectionStatus === "checking" ? "Checking..." : "Retry Connection"}
          </Button>

          <div className="nav-item-secondary flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isPollingLatest ? "animate-spin text-primary" : "text-muted-foreground"}`} />
            <span className="text-xs text-foreground">{isPollingLatest ? "Checking new data..." : "Auto-sync every 2s"}</span>
          </div>

          <button
            type="button"
            onClick={() => setNotificationDrawerOpen((previous) => !previous)}
            className={cn(
              "relative flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 transition-colors",
              notificationDrawerOpen
                ? "border-primary/50 bg-primary/15"
                : "border-border bg-secondary/60 hover:border-primary/30",
            )}
          >
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Live Feed</span>
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {analyzedCount.toLocaleString("en-IN")}
            </span>
            {unreadNotificationCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                {unreadNotificationCount}
              </span>
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="nav-item-secondary hidden shrink-0 items-center gap-2 rounded-full border border-border bg-secondary/60 px-2 py-1 sm:flex"
              >
                <div className="pr-1 text-left leading-tight">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Security Analyst</span>
                    <span className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-300">
                      Tier 2
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-foreground">
                    <span>session {sessionDuration}</span>
                    <span className="text-muted-foreground">|</span>
                    <span>{casesResolved} resolved</span>
                  </div>
                </div>
                <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-cyan-500/30 text-[11px] font-semibold text-foreground">
                  SC
                  {isLive && <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400" />}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 border-zinc-700 bg-zinc-950 text-zinc-100">
              <DropdownMenuLabel className="font-mono text-xs text-zinc-300">Analyst Session</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem className="text-xs focus:bg-zinc-800">Full Name: Swayam Copilot</DropdownMenuItem>
              <DropdownMenuItem className="text-xs focus:bg-zinc-800">Tier: Tier 2 - Fraud Ops</DropdownMenuItem>
              <DropdownMenuItem className="text-xs focus:bg-zinc-800">Shift Start: {shiftStart} IST</DropdownMenuItem>
              <DropdownMenuItem className="text-xs focus:bg-zinc-800">Cases Resolved Today: {casesResolved}</DropdownMenuItem>
              <DropdownMenuItem className="text-xs focus:bg-zinc-800">Cases Escalated Today: {casesEscalated}</DropdownMenuItem>
              <DropdownMenuItem className="text-xs focus:bg-zinc-800">
                Average Response Time: {formatElapsed(avgResponseSeconds)}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem className="text-xs text-red-300 focus:bg-red-500/20 focus:text-red-200">Log Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        className={cn(
          "absolute right-4 top-[calc(100%+6px)] z-40 w-[360px] transition-all duration-200 sm:right-6",
          notificationDrawerOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <div className="rounded-xl border border-zinc-700 bg-zinc-950/95 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-300">Notification Feed</p>
            <button
              type="button"
              onClick={() => setNotificationDrawerOpen(false)}
              className="text-[10px] uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-200"
            >
              Close
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {notifications.length === 0 ? (
              <p className="px-2 py-3 text-xs text-zinc-500">No notifications yet.</p>
            ) : (
              <ul className="space-y-1">
                {notifications.map((item) => (
                  <li key={item.id} className="rounded-md border border-zinc-800 bg-black/30 px-2 py-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">{notificationIcon(item.level)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-zinc-100">{item.title}</p>
                        {item.detail && <p className="text-[10px] text-zinc-400">{item.detail}</p>}
                        <p className="mt-1 font-mono text-[10px] text-zinc-500">
                          {new Date(item.timestamp).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false,
                          })}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
