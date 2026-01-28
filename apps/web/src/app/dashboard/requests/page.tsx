"use client";

import { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Warning,
  MapTrifold,
  User,
  CalendarBlank,
  Timer,
} from "@phosphor-icons/react";
import { toast } from "sonner";

interface RequestUser {
  id: string;
  name: string;
  initials: string;
  position: string;
  email: string;
}

interface Request {
  id: string;
  user: RequestUser;
  type: "clock_in" | "clock_out";
  reason: string;
  distance: number;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  status: "pending" | "approved" | "denied";
  requestedTime: string;
  submittedAt: string;
  expiresAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  reviewerNote?: string;
  denialReason?: string;
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function RequestsPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<Request[]>([]);
  const [resolvedRequests, setResolvedRequests] = useState<Request[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [actionType, setActionType] = useState<"approve" | "deny" | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const [pendingRes, resolvedRes] = await Promise.all([
        fetch("/api/requests?status=pending"),
        fetch("/api/requests?status=resolved"),
      ]);

      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        if (pendingData.success) {
          setPendingRequests(pendingData.requests);
        }
      }

      if (resolvedRes.ok) {
        const resolvedData = await resolvedRes.json();
        if (resolvedData.success) {
          setResolvedRequests(resolvedData.requests);
        }
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
      toast.error("Failed to load requests");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (type: "approve" | "deny") => {
    if (!selectedRequest) return;

    if (type === "deny" && !reviewerNote.trim()) {
      toast.error("Please provide a reason for denial");
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

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        fetchRequests();
        setSelectedRequest(null);
        setActionType(null);
        setReviewerNote("");
      } else {
        toast.error(data.error || "Failed to process request");
      }
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openMapLocation = (location: {
    latitude: number;
    longitude: number;
  }) => {
    const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    window.open(url, "_blank");
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const approvedCount = resolvedRequests.filter(
    (r) => r.status === "approved"
  ).length;
  const deniedCount = resolvedRequests.filter(
    (r) => r.status === "denied"
  ).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("requests.title")}</h1>
        <p className="text-muted-foreground">
          {t("requests.subtitle")}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <Clock className="size-5" weight="duotone" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingRequests.length}</p>
                <p className="text-sm text-muted-foreground">{t("requests.stats.pending")}</p>
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
                <p className="text-2xl font-bold">{approvedCount}</p>
                <p className="text-sm text-muted-foreground">{t("requests.stats.approved7d")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <XCircle className="size-5" weight="duotone" />
              </div>
              <div>
                <p className="text-2xl font-bold">{deniedCount}</p>
                <p className="text-sm text-muted-foreground">{t("requests.stats.denied7d")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            {t("requests.tabs.pending")}
            {pendingRequests.length > 0 && (
              <Badge
                variant="warning"
                className="ml-1 size-5 p-0 text-[10px] flex justify-center items-center"
              >
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved">{t("requests.tabs.resolved")}</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="mb-4 size-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">{t("requests.empty.allCaughtUp")}</h3>
                <p className="text-muted-foreground">
                  {t("requests.empty.noPending")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingRequests.map((request) => (
                <Card key={request.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex">
                      {/* Request Info */}
                      <div className="flex-1 p-6">
                        <div className="mb-4 flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-12">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {request.user.initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold">
                                {request.user.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {request.user.position}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={
                              request.type === "clock_in"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {request.type === "clock_in"
                              ? t("requests.type.clockIn")
                              : t("requests.type.clockOut")}
                          </Badge>
                        </div>

                        <div className="mb-4 rounded-lg border bg-muted/30 p-4">
                          <p className="text-sm italic text-muted-foreground">
                            &ldquo;{request.reason}&rdquo;
                          </p>
                        </div>

                        <div className="grid gap-3 text-sm md:grid-cols-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="size-4" />
                            <span>
                              <strong className="text-foreground">
                                {formatDistance(request.distance)}
                              </strong>{" "}
                              {t("requests.fromWorkLocation")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CalendarBlank className="size-4" />
                            <span>
                              {t("requests.requestedFor")}{" "}
                              <strong className="text-foreground">
                                {formatDateTime(request.requestedTime)}
                              </strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Timer className="size-4" />
                            <span>
                              {t("requests.submitted")} {getTimeAgo(request.submittedAt)}
                            </span>
                          </div>
                          {request.expiresAt && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Warning className="size-4 text-warning" />
                              <span>
                                {t("requests.expires")} {formatDateTime(request.expiresAt)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex w-48 flex-col border-l bg-muted/20 p-4">
                        <Button
                          className="mb-2 gap-2"
                          onClick={() => {
                            setSelectedRequest(request);
                            setActionType("approve");
                          }}
                        >
                          <CheckCircle className="size-4" />
                          {t("requests.actions.approve")}
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => {
                            setSelectedRequest(request);
                            setActionType("deny");
                          }}
                        >
                          <XCircle className="size-4" />
                          {t("requests.actions.deny")}
                        </Button>
                        <Separator className="my-4" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => openMapLocation(request.location)}
                        >
                          <MapTrifold className="size-4" />
                          {t("requests.viewMap")}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="resolved">
          {resolvedRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="mb-4 size-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">
                  {t("requests.empty.noResolved")}
                </h3>
                <p className="text-muted-foreground">
                  {t("requests.empty.noResolvedDesc")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t("requests.recentlyResolved")}</CardTitle>
                <CardDescription>
                  {t("requests.resolvedIn7Days")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {resolvedRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-4 rounded-lg border p-4"
                    >
                      <Avatar>
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {request.user.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {request.user.name}
                          </span>
                          <Badge
                            variant={
                              request.type === "clock_in"
                                ? "outline"
                                : "secondary"
                            }
                          >
                            {request.type === "clock_in"
                              ? t("requests.type.clockIn")
                              : t("requests.type.clockOut")}
                          </Badge>
                          <Badge
                            variant={
                              request.status === "approved"
                                ? "success"
                                : "destructive"
                            }
                          >
                            {request.status === "approved"
                              ? t("requests.status.approved")
                              : t("requests.status.denied")}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                          {request.reason}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {request.status === "approved"
                            ? request.reviewerNote || "Approved"
                            : request.denialReason}{" "}
                          {request.resolvedBy && `— by ${request.resolvedBy}`}
                        </p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{formatDistance(request.distance)}</p>
                        {request.resolvedAt && (
                          <p>{getTimeAgo(request.resolvedAt)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
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
              {actionType === "approve" ? t("requests.dialog.approveTitle") : t("requests.dialog.denyTitle")}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? t("requests.dialog.approveDesc", {
                    name: selectedRequest?.user.name,
                    type: selectedRequest?.type === "clock_in" ? t("requests.type.clockIn") : t("requests.type.clockOut")
                  })
                : t("requests.dialog.denyDesc", {
                    name: selectedRequest?.user.name,
                    type: selectedRequest?.type === "clock_in" ? t("requests.type.clockIn") : t("requests.type.clockOut")
                  })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {selectedRequest?.user.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedRequest?.user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistance(selectedRequest?.distance || 0)} {t("requests.fromWorkLocation")}
                  </p>
                </div>
              </div>
              <p className="text-sm italic text-muted-foreground">
                &ldquo;{selectedRequest?.reason}&rdquo;
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">
                {actionType === "approve"
                  ? t("requests.dialog.noteOptional")
                  : t("requests.dialog.denialReasonRequired")}
              </Label>
              <Textarea
                id="note"
                placeholder={
                  actionType === "approve"
                    ? t("requests.dialog.notePlaceholder")
                    : t("requests.dialog.denialPlaceholder")
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
              onClick={() => handleAction(actionType!)}
              disabled={
                isSubmitting || (actionType === "deny" && !reviewerNote.trim())
              }
            >
              {isSubmitting ? (
                tc("buttons.loading")
              ) : actionType === "approve" ? (
                <>
                  <CheckCircle className="mr-2 size-4" />
                  {t("requests.dialog.approveButton")}
                </>
              ) : (
                <>
                  <XCircle className="mr-2 size-4" />
                  {t("requests.dialog.denyButton")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
