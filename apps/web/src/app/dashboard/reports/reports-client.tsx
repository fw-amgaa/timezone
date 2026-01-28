"use client";

import { useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Users,
  TrendUp,
  TrendDown,
  ChartBar,
  Export,
  CalendarBlank,
  MapPin,
  CheckCircle,
  XCircle,
  Hourglass,
  Warning,
  Lightning,
} from "@phosphor-icons/react";
import { toast } from "sonner";

interface ReportData {
  summary: {
    totalWeekHours: number;
    totalMonthHours: number;
    monthChange: number;
    totalShiftsMonth: number;
    activeEmployees: number;
    totalEmployees: number;
    overtimeEmployees: number;
    requests: {
      approved: number;
      denied: number;
      pending: number;
    };
  };
  employeeHours: {
    id: string;
    name: string;
    initials: string;
    position: string;
    weekHours: number;
    monthHours: number;
    lastMonthHours: number;
    shiftsCount: number;
    avgHoursPerShift: number;
    isOvertime: boolean;
  }[];
  locationStats: {
    id: string;
    name: string;
    totalHours: number;
    shiftsCount: number;
    uniqueEmployees: number;
  }[];
}

function StatCard({
  title,
  value,
  change,
  icon: Icon,
  description,
  variant = "default",
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: any;
  description?: string;
  variant?: "default" | "warning" | "success";
}) {
  const bgColor =
    variant === "warning"
      ? "bg-warning/10 text-warning"
      : variant === "success"
        ? "bg-success/10 text-success"
        : "bg-primary/10 text-primary";

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 text-3xl font-bold">{value}</p>
          </div>
          <div className={`flex size-10 items-center justify-center rounded-lg ${bgColor}`}>
            <Icon className="size-5" weight="duotone" />
          </div>
        </div>
        {(change !== undefined || description) && (
          <div className="mt-3 flex items-center gap-2">
            {change !== undefined && (
              <span
                className={`flex items-center gap-0.5 text-sm font-medium ${
                  change >= 0 ? "text-success" : "text-warning"
                }`}
              >
                {change >= 0 ? (
                  <TrendUp className="size-4" weight="bold" />
                ) : (
                  <TrendDown className="size-4" weight="bold" />
                )}
                {Math.abs(change)}%
              </span>
            )}
            {description && (
              <span className="text-sm text-muted-foreground">{description}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportsClient({ data }: { data: ReportData }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tt = useTranslations("time");
  const [dateRange, setDateRange] = useState("month");

  const handleExport = (type: string) => {
    toast.info(`Exporting ${type} report...`);
    // In a real app, this would generate and download a CSV/PDF
  };

  const maxEmployeeHours = Math.max(...data.employeeHours.map((e) => e.monthHours), 1);
  const maxLocationHours = Math.max(...data.locationStats.map((l) => l.totalHours), 1);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("reports.title")}</h1>
          <p className="text-muted-foreground">
            {t("reports.subtitle")}
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <CalendarBlank className="mr-2 size-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">{tt("periods.thisWeek")}</SelectItem>
              <SelectItem value="month">{tt("periods.thisMonth")}</SelectItem>
              <SelectItem value="quarter">{t("reports.period.thisQuarter")}</SelectItem>
              <SelectItem value="year">{tt("periods.thisYear")}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2" onClick={() => handleExport("summary")}>
            <Export className="size-4" />
            {tc("buttons.export")}
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("reports.metrics.totalHoursMonth")}
          value={`${data.summary.totalMonthHours}h`}
          change={data.summary.monthChange}
          icon={Clock}
          description={t("reports.vsLastMonth")}
        />
        <StatCard
          title={t("reports.metrics.activeEmployees")}
          value={`${data.summary.activeEmployees}/${data.summary.totalEmployees}`}
          icon={Users}
          description={t("reports.workedThisMonth")}
        />
        <StatCard
          title={t("reports.metrics.shiftsCompleted")}
          value={data.summary.totalShiftsMonth}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title={t("reports.metrics.overtimeThisWeek")}
          value={data.summary.overtimeEmployees}
          icon={Warning}
          variant={data.summary.overtimeEmployees > 0 ? "warning" : "default"}
          description={t("reports.employeesOver40h")}
        />
      </div>

      {/* Tabs for different reports */}
      <Tabs defaultValue="hours" className="space-y-6">
        <TabsList>
          <TabsTrigger value="hours" className="gap-2">
            <Clock className="size-4" />
            {t("reports.types.hoursByEmployee")}
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-2">
            <MapPin className="size-4" />
            {t("reports.types.hoursByLocation")}
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <ChartBar className="size-4" />
            {t("reports.types.requests")}
          </TabsTrigger>
          <TabsTrigger value="overtime" className="gap-2">
            <Lightning className="size-4" />
            {t("reports.types.overtime")}
          </TabsTrigger>
        </TabsList>

        {/* Hours by Employee */}
        <TabsContent value="hours">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("reports.types.hoursByEmployee")}</CardTitle>
                <CardDescription>
                  {t("reports.hoursByEmployeeDesc")}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleExport("employee-hours")}>
                <Export className="mr-2 size-4" />
                {t("reports.exportCSV")}
              </Button>
            </CardHeader>
            <CardContent>
              {data.employeeHours.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  {t("reports.noDataAvailable")}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("reports.columns.employee")}</TableHead>
                      <TableHead>{tt("periods.thisWeek")}</TableHead>
                      <TableHead>{tt("periods.thisMonth")}</TableHead>
                      <TableHead className="hidden md:table-cell">{tt("periods.lastMonth")}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t("reports.columns.shifts")}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t("reports.columns.avgPerShift")}</TableHead>
                      <TableHead>{t("reports.columns.progress")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.employeeHours.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                                {employee.initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{employee.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {employee.position}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {employee.weekHours}h
                            {employee.isOvertime && (
                              <Badge variant="warning" className="text-xs">
                                OT
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{employee.monthHours}h</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {employee.lastMonthHours}h
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {employee.shiftsCount}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {employee.avgHoursPerShift}h
                        </TableCell>
                        <TableCell className="w-[150px]">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={(employee.monthHours / maxEmployeeHours) * 100}
                              className="h-2"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Location */}
        <TabsContent value="locations">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("reports.types.hoursByLocation")}</CardTitle>
                <CardDescription>
                  {t("reports.hoursByLocationDesc")}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleExport("location-hours")}>
                <Export className="mr-2 size-4" />
                {t("reports.exportCSV")}
              </Button>
            </CardHeader>
            <CardContent>
              {data.locationStats.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  {t("reports.noLocationData")}
                </p>
              ) : (
                <div className="space-y-6">
                  {data.locationStats.map((location) => (
                    <div key={location.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                            <MapPin className="size-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{location.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {location.shiftsCount} {t("reports.shiftsUnit")} • {location.uniqueEmployees} {t("reports.employeesUnit")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{location.totalHours}h</p>
                          <p className="text-sm text-muted-foreground">{t("reports.totalHours")}</p>
                        </div>
                      </div>
                      <Progress
                        value={(location.totalHours / maxLocationHours) * 100}
                        className="h-3"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requests */}
        <TabsContent value="requests">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("reports.requestSummary")}</CardTitle>
                <CardDescription>{t("reports.requestSummaryDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-success/10">
                        <CheckCircle className="size-5 text-success" />
                      </div>
                      <div>
                        <p className="font-medium">{t("reports.requestStatus.approved")}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("reports.requestStatus.approvedDesc")}
                        </p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-success">
                      {data.summary.requests.approved}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
                        <XCircle className="size-5 text-destructive" />
                      </div>
                      <div>
                        <p className="font-medium">{t("reports.requestStatus.denied")}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("reports.requestStatus.deniedDesc")}
                        </p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-destructive">
                      {data.summary.requests.denied}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-warning/10">
                        <Hourglass className="size-5 text-warning" />
                      </div>
                      <div>
                        <p className="font-medium">{t("reports.requestStatus.pending")}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("reports.requestStatus.pendingDesc")}
                        </p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-warning">
                      {data.summary.requests.pending}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("reports.approvalRate")}</CardTitle>
                <CardDescription>{t("reports.approvalRateDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const total =
                    data.summary.requests.approved + data.summary.requests.denied;
                  const rate = total > 0
                    ? Math.round((data.summary.requests.approved / total) * 100)
                    : 0;
                  return (
                    <div className="flex flex-col items-center py-8">
                      <div className="relative mb-4">
                        <svg className="size-32" viewBox="0 0 100 100">
                          <circle
                            className="stroke-muted"
                            strokeWidth="10"
                            fill="transparent"
                            r="40"
                            cx="50"
                            cy="50"
                          />
                          <circle
                            className="stroke-success transition-all duration-500"
                            strokeWidth="10"
                            strokeLinecap="round"
                            fill="transparent"
                            r="40"
                            cx="50"
                            cy="50"
                            strokeDasharray={`${rate * 2.51} 251`}
                            transform="rotate(-90 50 50)"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-3xl font-bold">{rate}%</span>
                        </div>
                      </div>
                      <p className="text-muted-foreground">
                        {t("reports.totalRequestsProcessed", { count: total })}
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Overtime */}
        <TabsContent value="overtime">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("reports.overtimeReport")}</CardTitle>
                <CardDescription>
                  {t("reports.overtimeReportDesc")}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleExport("overtime")}>
                <Export className="mr-2 size-4" />
                {t("reports.exportCSV")}
              </Button>
            </CardHeader>
            <CardContent>
              {data.summary.overtimeEmployees === 0 ? (
                <div className="flex flex-col items-center py-12">
                  <CheckCircle className="mb-4 size-12 text-success" />
                  <h3 className="text-lg font-semibold">{t("reports.noOvertimeTitle")}</h3>
                  <p className="text-center text-muted-foreground">
                    {t("reports.noOvertimeDesc")}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("reports.columns.employee")}</TableHead>
                      <TableHead>{t("reports.columns.thisWeekHours")}</TableHead>
                      <TableHead>{t("reports.columns.overtimeHours")}</TableHead>
                      <TableHead>{t("reports.columns.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.employeeHours
                      .filter((e) => e.isOvertime)
                      .map((employee) => {
                        const overtimeHours = Math.max(0, employee.weekHours - 40);
                        return (
                          <TableRow key={employee.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="size-8">
                                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                                    {employee.initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{employee.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {employee.position}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {employee.weekHours}h
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-warning">
                                +{overtimeHours.toFixed(1)}h
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="warning">{t("reports.types.overtime")}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
