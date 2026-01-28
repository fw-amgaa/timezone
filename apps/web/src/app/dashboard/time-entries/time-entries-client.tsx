"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MagnifyingGlass,
  Calendar,
  Clock,
  MapPin,
  Export,
  FunnelSimple,
  Moon,
  Warning,
  CheckCircle,
  Hourglass,
} from "@phosphor-icons/react";
import { formatDurationFromMinutes } from "@timezone/utils/shifts";

interface TimeEntry {
  id: string;
  user: {
    id: string;
    name: string;
    initials: string;
    position: string;
  };
  date: string;
  clockIn: string;
  clockOut: string | null;
  duration: number | null;
  location: string;
  status: string;
  crossedMidnight: boolean;
  hoursOpen?: number;
  isRevised?: boolean;
  clockInLocationStatus?: string | null;
  clockOutLocationStatus?: string | null;
}

interface Stats {
  totalHoursToday: number;
  totalHoursWeek: number;
  completedToday: number;
  inProgressToday: number;
  staleCount: number;
}

export function TimeEntriesClient({
  entries,
  stats,
}: {
  entries: TimeEntry[];
  stats: Stats;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tt = useTranslations("time");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("week");

  const getStatusBadge = (entry: TimeEntry) => {
    switch (entry.status) {
      case "closed":
        return <Badge variant="success">{t("timeEntries.status.closed")}</Badge>;
      case "open":
        return <Badge variant="default">{t("timeEntries.status.open")}</Badge>;
      case "revised":
        return <Badge variant="warning">{t("timeEntries.status.revised")}</Badge>;
      case "stale":
        return <Badge variant="destructive">{t("timeEntries.status.stale")}</Badge>;
      case "pending_revision":
        return <Badge variant="pending">{t("timeEntries.status.pendingRevision")}</Badge>;
      default:
        return <Badge variant="outline">{entry.status}</Badge>;
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split("T")[0]) {
      return tt("periods.today");
    }
    if (dateStr === yesterday.toISOString().split("T")[0]) {
      return tt("periods.yesterday");
    }

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const filteredEntries = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(today);
    monthStart.setDate(monthStart.getDate() - 30);

    return entries.filter((entry) => {
      const matchesSearch =
        entry.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.location.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        selectedStatus === "all" ||
        entry.status === selectedStatus ||
        (selectedStatus === "completed" && entry.status === "closed");

      const entryDate = new Date(entry.date);
      let matchesDate = true;
      if (dateRange === "today") {
        matchesDate = entry.date === today.toISOString().split("T")[0];
      } else if (dateRange === "week") {
        matchesDate = entryDate >= weekStart;
      } else if (dateRange === "month") {
        matchesDate = entryDate >= monthStart;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [entries, searchQuery, selectedStatus, dateRange]);

  const totalMinutes = filteredEntries.reduce(
    (sum, entry) => sum + (entry.duration || 0),
    0
  );

  const nightShiftsCount = filteredEntries.filter((e) => e.crossedMidnight).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("timeEntries.title")}</h1>
          <p className="text-muted-foreground">
            {t("timeEntries.subtitle")}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Export className="size-4" />
            {tc("buttons.export")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="size-5" weight="duotone" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatDurationFromMinutes(stats.totalHoursWeek)}
                </p>
                <p className="text-sm text-muted-foreground">{tt("periods.thisWeek")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <CheckCircle className="size-5" weight="duotone" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completedToday}</p>
                <p className="text-sm text-muted-foreground">{tc("status.completed")} {tt("periods.today")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                <Hourglass className="size-5" weight="duotone" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inProgressToday}</p>
                <p className="text-sm text-muted-foreground">{tc("status.inProgress")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <Warning className="size-5" weight="duotone" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.staleCount}</p>
                <p className="text-sm text-muted-foreground">{t("stats.staleShifts")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative min-w-[200px] flex-1">
              <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={tc("buttons.search") + "..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="mr-2 size-4" />
                <SelectValue placeholder={t("timeEntries.filters.dateRange")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{tt("periods.today")}</SelectItem>
                <SelectItem value="week">{tt("periods.lastWeek")}</SelectItem>
                <SelectItem value="month">{tt("periods.lastMonth")}</SelectItem>
                <SelectItem value="all">{tt("periods.allTime")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[150px]">
                <FunnelSimple className="mr-2 size-4" />
                <SelectValue placeholder={tc("labels.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("employees.filters.all")}</SelectItem>
                <SelectItem value="completed">{tc("status.completed")}</SelectItem>
                <SelectItem value="open">{tc("status.inProgress")}</SelectItem>
                <SelectItem value="revised">{tc("status.revised")}</SelectItem>
                <SelectItem value="stale">{tc("status.stale")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Time Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("timeEntries.title")}</CardTitle>
          <CardDescription>
            {filteredEntries.length} {t("history.entries")} •{" "}
            {formatDurationFromMinutes(totalMinutes)} {tc("labels.total").toLowerCase()}
            {nightShiftsCount > 0 && (
              <span className="ml-2">
                • {nightShiftsCount} {t("timeEntries.nightShift")}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Clock className="mb-4 size-12 text-muted-foreground" />
              <p className="text-muted-foreground">{t("timeEntries.noEntries")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("timeEntries.columns.employee")}</TableHead>
                  <TableHead>{t("timeEntries.columns.date")}</TableHead>
                  <TableHead>{t("timeEntries.columns.clockIn")}</TableHead>
                  <TableHead>{t("timeEntries.columns.clockOut")}</TableHead>
                  <TableHead>{t("timeEntries.columns.duration")}</TableHead>
                  <TableHead>{t("timeEntries.columns.location")}</TableHead>
                  <TableHead>{t("timeEntries.columns.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className={
                      entry.status === "stale"
                        ? "bg-warning/5"
                        : entry.status === "open"
                          ? "bg-primary/5"
                          : ""
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 text-xs text-primary">
                            {entry.user.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{entry.user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.user.position}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(entry.date)}
                    </TableCell>
                    <TableCell>{entry.clockIn}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.clockOut || "—"}
                        {entry.crossedMidnight && (
                          <Moon
                            className="size-4 text-indigo-500"
                            weight="fill"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.duration ? (
                        <span className="font-medium">
                          {formatDurationFromMinutes(entry.duration)}
                        </span>
                      ) : entry.status === "stale" || entry.status === "open" ? (
                        <span
                          className={`font-medium ${
                            entry.status === "stale"
                              ? "text-warning"
                              : "text-primary"
                          }`}
                        >
                          {entry.hoursOpen}{tt("units.h")}+ {tc("status.open").toLowerCase()}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="size-3 text-muted-foreground" />
                        <span className="text-sm">{entry.location}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(entry)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
