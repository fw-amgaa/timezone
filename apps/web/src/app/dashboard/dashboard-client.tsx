"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Users,
  Clock,
  ClockClockwise,
  Warning,
  TrendUp,
  ArrowRight,
  CheckCircle,
  XCircle,
  Hourglass,
  MapPin,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import Link from "next/link";

interface DashboardData {
  stats: {
    activeEmployees: number;
    hoursToday: string;
    pendingRequests: number;
    staleShifts: number;
  };
  pendingRequests: {
    id: string;
    user: { name: string; initials: string };
    type: string;
    reason: string;
    distance: string;
    submittedAt: string;
  }[];
  staleShifts: {
    id: string;
    user: { name: string; initials: string };
    clockedInAt: string;
    duration: string;
    location: string;
  }[];
  recentActivity: {
    id: string;
    user: { name: string; initials: string };
    action: string;
    location: string;
    time: string;
    duration?: string;
  }[];
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tt = useTranslations("time");

  const getTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return tt("relative.short.justNow");
    if (diffMins < 60) return tt("relative.short.minutesAgo", { count: diffMins });
    if (diffHours < 24) return tt("relative.short.hoursAgo", { count: diffHours });
    return tt("relative.short.daysAgo", { count: diffDays });
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "clocked_in":
        return { label: t("activity.clockedIn"), color: "success" as const };
      case "clocked_out":
        return { label: t("activity.clockedOut"), color: "secondary" as const };
      case "stale":
        return { label: t("activity.stale"), color: "warning" as const };
      case "shift_completed":
        return { label: t("activity.completed"), color: "default" as const };
      default:
        return { label: action, color: "secondary" as const };
    }
  };
  const [selectedRequest, setSelectedRequest] = useState<
    (typeof data.pendingRequests)[0] | null
  >(null);
  const [selectedStaleShift, setSelectedStaleShift] = useState<
    (typeof data.staleShifts)[0] | null
  >(null);
  const [actionType, setActionType] = useState<"approve" | "deny" | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staleResolution, setStaleResolution] = useState<
    "forgot" | "actual_hours"
  >("forgot");
  const [actualClockOut, setActualClockOut] = useState("");

  const stats = [
    {
      title: t("stats.activeEmployees"),
      value: data.stats.activeEmployees.toString(),
      icon: Users,
      description: t("stats.currentlyIn"),
      color: "primary",
    },
    {
      title: t("stats.hoursToday"),
      value: data.stats.hoursToday,
      icon: Clock,
      description: t("stats.totalWorked"),
      color: "primary",
    },
    {
      title: t("stats.pendingRequests"),
      value: data.stats.pendingRequests.toString(),
      icon: ClockClockwise,
      description: t("stats.awaitingApproval"),
      color: "primary",
      href: "/dashboard/requests",
    },
    {
      title: t("stats.staleShifts"),
      value: data.stats.staleShifts.toString(),
      icon: Warning,
      description: t("stats.needsResolution"),
      color: data.stats.staleShifts > 0 ? "warning" : "primary",
    },
  ];

  const handleRequestAction = async (type: "approve" | "deny") => {
    if (!selectedRequest) return;

    if (type === "deny" && !reviewerNote.trim()) {
      toast.error(t("requests.denyDialog.reasonRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          action: type,
          note: type === "approve" ? reviewerNote : undefined,
          denialReason: type === "deny" ? reviewerNote : undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(type === "approve" ? t("requests.successApproved") : t("requests.successDenied"));
        setSelectedRequest(null);
        setActionType(null);
        setReviewerNote("");
        router.refresh();
      } else {
        toast.error(result.error || tc("errors.generic"));
      }
    } catch {
      toast.error(tc("errors.generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveStaleShift = async () => {
    if (!selectedStaleShift) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/shifts/stale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: selectedStaleShift.id,
          resolution: staleResolution,
          actualClockOut:
            staleResolution === "actual_hours" ? actualClockOut : undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(t("staleShifts.success"));
        setSelectedStaleShift(null);
        setStaleResolution("forgot");
        setActualClockOut("");
        router.refresh();
      } else {
        toast.error(result.error || t("staleShifts.failed"));
      }
    } catch {
      toast.error(tc("errors.generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("welcome")}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="mt-1 text-3xl font-bold">{stat.value}</p>
                </div>
                <div
                  className={`flex size-10 items-center justify-center rounded-lg ${
                    stat.color === "warning"
                      ? "bg-warning/10 text-warning"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <stat.icon className="size-5" weight="duotone" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {stat.description}
                </span>
                {stat.href && (
                  <Link
                    href={stat.href}
                    className="ml-auto text-sm text-primary hover:underline"
                  >
                    {tc("buttons.viewAll")}
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("activity.title")}</CardTitle>
              <CardDescription>
                {t("activity.subtitle")}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1" asChild>
              <Link href="/dashboard/time-entries">
                {tc("buttons.viewAll")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                {t("activity.noActivity")}
              </p>
            ) : (
              <div className="space-y-4">
                {data.recentActivity.map((activity) => {
                  const actionInfo = getActionLabel(activity.action);
                  return (
                    <div
                      key={activity.id}
                      className="flex items-center gap-4 rounded-lg border p-4"
                    >
                      <Avatar>
                        <AvatarFallback className="bg-primary/10 text-sm text-primary">
                          {activity.user.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {activity.user.name}
                          </span>
                          <Badge variant={actionInfo.color}>
                            {actionInfo.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="size-3" />
                          {activity.location}
                          {activity.duration && (
                            <>
                              <span className="text-muted-foreground/50">
                                •
                              </span>
                              <Clock className="size-3" />
                              {activity.duration}
                            </>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {getTimeAgo(activity.time)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {t("requests.title")}
                {data.pendingRequests.length > 0 && (
                  <Badge variant="warning">{data.pendingRequests.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>{t("requests.pending")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {data.pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle className="mb-2 size-8 text-success" />
                <p className="text-muted-foreground">{t("activity.allCaughtUp")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="space-y-3 rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {request.user.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{request.user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {request.type === "clock_in" ? t("activity.clockedIn") : t("activity.clockedOut")}{" "}
                          • {request.distance}
                        </p>
                      </div>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      &ldquo;{request.reason}&rdquo;
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => {
                          setSelectedRequest(request);
                          setActionType("approve");
                        }}
                      >
                        <CheckCircle className="size-4" />
                        {t("requests.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1"
                        onClick={() => {
                          setSelectedRequest(request);
                          setActionType("deny");
                        }}
                      >
                        <XCircle className="size-4" />
                        {t("requests.deny")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stale Shifts Alert */}
      {data.staleShifts.length > 0 && (
        <Card className="mt-8 border-warning/50 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <Warning className="size-5" weight="fill" />
              {t("staleShifts.title")}
            </CardTitle>
            <CardDescription>
              {t("staleShifts.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {data.staleShifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center gap-4 rounded-lg border bg-background p-4"
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-warning/10">
                    <Hourglass className="size-5 text-warning" weight="fill" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {shift.user.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{shift.user.name}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("staleShifts.clockedIn")} {formatDateTime(shift.clockedInAt)} •{" "}
                      {shift.location}
                    </p>
                    <p className="text-sm font-medium text-warning">
                      {t("staleShifts.openFor")} {shift.duration}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setSelectedStaleShift(shift)}
                  >
                    {tc("buttons.resolve")}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request Action Dialog */}
      <Dialog
        open={!!selectedRequest && !!actionType}
        onOpenChange={() => {
          setSelectedRequest(null);
          setActionType(null);
          setReviewerNote("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? t("requests.approveDialog.title") : t("requests.denyDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? t("requests.approveDialog.message")
                : t("requests.denyDialog.message")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm italic text-muted-foreground">
                &ldquo;{selectedRequest?.reason}&rdquo;
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">
                {actionType === "approve"
                  ? t("requests.approveDialog.note")
                  : t("requests.denialReason")}
              </Label>
              <Textarea
                id="note"
                placeholder={
                  actionType === "approve"
                    ? t("requests.approveDialog.notePlaceholder")
                    : t("requests.denialReasonPlaceholder")
                }
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRequest(null);
                setActionType(null);
                setReviewerNote("");
              }}
              disabled={isSubmitting}
            >
              {tc("buttons.cancel")}
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              onClick={() => handleRequestAction(actionType!)}
              disabled={
                isSubmitting || (actionType === "deny" && !reviewerNote.trim())
              }
            >
              {isSubmitting
                ? tc("buttons.loading")
                : actionType === "approve"
                  ? tc("buttons.approve")
                  : tc("buttons.deny")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stale Shift Resolution Dialog */}
      <Dialog
        open={!!selectedStaleShift}
        onOpenChange={() => {
          setSelectedStaleShift(null);
          setStaleResolution("forgot");
          setActualClockOut("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("staleShifts.resolveTitle")}</DialogTitle>
            <DialogDescription>
              {t("staleShifts.resolveDescription", {
                name: selectedStaleShift?.user.name || "",
                duration: selectedStaleShift?.duration || ""
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup
              value={staleResolution}
              onValueChange={(v) =>
                setStaleResolution(v as "forgot" | "actual_hours")
              }
            >
              <div className="flex items-start space-x-3 rounded-lg border p-4">
                <RadioGroupItem value="forgot" id="forgot" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="forgot" className="font-medium">
                    {t("staleShifts.forgotOption")}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t("staleShifts.forgotDescription")}
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 rounded-lg border p-4">
                <RadioGroupItem
                  value="actual_hours"
                  id="actual_hours"
                  className="mt-1"
                />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="actual_hours" className="font-medium">
                    {t("staleShifts.actualHoursOption")}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t("staleShifts.actualHoursDescription")}
                  </p>
                  {staleResolution === "actual_hours" && (
                    <input
                      type="datetime-local"
                      className="mt-2 w-full rounded-md border bg-background px-3 py-2"
                      value={actualClockOut}
                      onChange={(e) => setActualClockOut(e.target.value)}
                    />
                  )}
                </div>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedStaleShift(null);
                setStaleResolution("forgot");
                setActualClockOut("");
              }}
              disabled={isSubmitting}
            >
              {tc("buttons.cancel")}
            </Button>
            <Button
              onClick={handleResolveStaleShift}
              disabled={
                isSubmitting ||
                (staleResolution === "actual_hours" && !actualClockOut)
              }
            >
              {isSubmitting ? t("staleShifts.resolving") : t("staleShifts.resolveButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
