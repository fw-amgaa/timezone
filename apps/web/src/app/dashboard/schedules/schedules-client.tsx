"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarBlank,
  Plus,
  DotsThree,
  PencilSimple,
  Trash,
  Users,
  Moon,
  Clock,
  Info,
  UserPlus,
} from "@phosphor-icons/react";
import { toast } from "sonner";

interface Slot {
  id?: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  breakMinutes: number;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  createdAt: string;
  slots: Slot[];
  assignmentCount: number;
}

interface Team {
  id: string;
  name: string;
  color: string | null;
  isActive: boolean;
}

interface Employee {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  position: string | null;
  role: string;
  isActive: boolean;
}

interface SchedulesClientProps {
  templates: Template[];
  teams: Team[];
  employees: Employee[];
  canEdit: boolean;
  canDelete: boolean;
}

const DAY_KEYS = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
] as const;

const TEMPLATE_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F97316",
  "#EAB308", "#22C55E", "#14B8A6", "#06B6D4", "#3B82F6",
];

const DEFAULT_SLOT: Slot = {
  dayOfWeek: "monday",
  startTime: "09:00",
  endTime: "17:00",
  crossesMidnight: false,
  breakMinutes: 0,
};

export function SchedulesClient({
  templates,
  teams,
  employees,
  canEdit,
  canDelete,
}: SchedulesClientProps) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tt = useTranslations("time");

  const DAYS_OF_WEEK = useMemo(() => DAY_KEYS.map(day => ({
    value: day,
    label: tt(`weekdays.${day}`),
    short: tt(`weekdaysShort.${day}`),
  })), [tt]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);
  const [assignTemplate, setAssignTemplate] = useState<Template | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: TEMPLATE_COLORS[0],
    slots: [{ ...DEFAULT_SLOT }] as Slot[],
  });

  const [assignType, setAssignType] = useState<"team" | "user">("team");
  const [assignTargetId, setAssignTargetId] = useState("");

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      color: TEMPLATE_COLORS[0],
      slots: [{ ...DEFAULT_SLOT }],
    });
    setEditingTemplate(null);
  };

  const openEditDialog = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      color: template.color || TEMPLATE_COLORS[0],
      slots:
        template.slots.length > 0
          ? template.slots.map((s) => ({ ...s }))
          : [{ ...DEFAULT_SLOT }],
    });
    setIsDialogOpen(true);
  };

  const addSlot = () => {
    setFormData({
      ...formData,
      slots: [...formData.slots, { ...DEFAULT_SLOT }],
    });
  };

  const removeSlot = (index: number) => {
    if (formData.slots.length <= 1) return;
    setFormData({
      ...formData,
      slots: formData.slots.filter((_, i) => i !== index),
    });
  };

  const updateSlot = (index: number, updates: Partial<Slot>) => {
    setFormData({
      ...formData,
      slots: formData.slots.map((slot, i) =>
        i === index ? { ...slot, ...updates } : slot
      ),
    });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Template name is required");
      return;
    }

    if (formData.slots.length === 0) {
      toast.error("At least one time slot is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingTemplate
        ? `/api/schedules/templates/${editingTemplate.id}`
        : "/api/schedules/templates";
      const method = editingTemplate ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          color: formData.color,
          slots: formData.slots,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          editingTemplate
            ? "Schedule updated successfully"
            : "Schedule created successfully"
        );
        setIsDialogOpen(false);
        resetForm();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to save schedule");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTemplate) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/schedules/templates/${deleteTemplate.id}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (result.success) {
        toast.success("Schedule deleted successfully");
        setDeleteTemplate(null);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete schedule");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssign = async () => {
    if (!assignTemplate || !assignTargetId) {
      toast.error("Please select a team or employee");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/schedules/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: assignTemplate.id,
          [assignType === "team" ? "teamId" : "userId"]: assignTargetId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Schedule assigned successfully");
        setAssignTemplate(null);
        setAssignTargetId("");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to assign schedule");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("schedules.title")}</h1>
          <p className="text-muted-foreground">
            {t("schedules.subtitle")}
          </p>
        </div>
        {canEdit && (
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" />
                {t("schedules.createTemplate")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? t("schedules.editTemplate") : t("schedules.createTemplate")}
                </DialogTitle>
                <DialogDescription>
                  {t("schedules.subtitle")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("schedules.templateName")} *</Label>
                    <Input
                      id="name"
                      placeholder={t("schedules.templateNamePlaceholder")}
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{tc("labels.color") || t("teams.color")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATE_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`size-6 rounded-full transition-all ${
                            formData.color === color
                              ? "ring-2 ring-offset-2 ring-primary"
                              : "hover:scale-110"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setFormData({ ...formData, color })}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{tc("labels.description")}</Label>
                  <Input
                    id="description"
                    placeholder={t("teams.descriptionPlaceholder")}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{t("schedules.slots")}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addSlot}
                      className="gap-1"
                    >
                      <Plus className="size-3" />
                      {t("schedules.addSlot")}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {formData.slots.map((slot, index) => (
                      <Card key={index} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Select
                              value={slot.dayOfWeek}
                              onValueChange={(val) =>
                                updateSlot(index, { dayOfWeek: val })
                              }
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DAYS_OF_WEEK.map((day) => (
                                  <SelectItem key={day.value} value={day.value}>
                                    {day.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {formData.slots.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => removeSlot(index)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash className="size-4" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">{t("schedules.startTime")}</Label>
                              <Input
                                type="time"
                                value={slot.startTime}
                                onChange={(e) =>
                                  updateSlot(index, { startTime: e.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{t("schedules.endTime")}</Label>
                              <Input
                                type="time"
                                value={slot.endTime}
                                onChange={(e) =>
                                  updateSlot(index, { endTime: e.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{t("schedules.breakMinutes")}</Label>
                              <Input
                                type="number"
                                min="0"
                                value={slot.breakMinutes}
                                onChange={(e) =>
                                  updateSlot(index, {
                                    breakMinutes: parseInt(e.target.value) || 0,
                                  })
                                }
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Switch
                              checked={slot.crossesMidnight}
                              onCheckedChange={(checked) =>
                                updateSlot(index, { crossesMidnight: checked })
                              }
                            />
                            <Label className="flex items-center gap-1 text-sm cursor-pointer">
                              <Moon className="size-4" />
                              {t("schedules.nightShift")}
                            </Label>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                  disabled={isSubmitting}
                >
                  {tc("buttons.cancel")}
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting
                    ? tc("buttons.loading")
                    : editingTemplate
                      ? t("schedules.editTemplate")
                      : t("schedules.createTemplate")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Info Card */}
      <Card className="mb-8 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                {t("schedules.notificationsTitle")}
              </p>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                {t("schedules.notificationsDescription")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarBlank className="mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">{t("schedules.noSchedules")}</h3>
            <p className="mb-4 text-center text-muted-foreground">
              {t("schedules.createFirst")}
            </p>
            {canEdit && (
              <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                <Plus className="size-4" />
                {t("schedules.createTemplate")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={openEditDialog}
              onDelete={setDeleteTemplate}
              onAssign={setAssignTemplate}
              formatTime={formatTime}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTemplate}
        onOpenChange={() => setDeleteTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("schedules.deleteTemplate")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("schedules.confirmDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>{tc("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? tc("buttons.loading") : tc("buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Dialog */}
      <Dialog
        open={!!assignTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setAssignTemplate(null);
            setAssignTargetId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("schedules.assignTo")}</DialogTitle>
            <DialogDescription>
              {t("schedules.assignDescription", { name: assignTemplate?.name })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("schedules.assignTo")}</Label>
              <Select
                value={assignType}
                onValueChange={(val: "team" | "user") => {
                  setAssignType(val);
                  setAssignTargetId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">{t("teams.title")}</SelectItem>
                  <SelectItem value="user">{t("employees.title")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {assignType === "team" ? t("schedules.assignToTeam") : t("schedules.assignToEmployee")}
              </Label>
              <Select value={assignTargetId} onValueChange={setAssignTargetId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      assignType === "team"
                        ? t("schedules.selectTeam")
                        : t("schedules.selectEmployee")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {assignType === "team"
                    ? teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))
                    : employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                          {emp.position ? ` - ${emp.position}` : ""}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignTemplate(null);
                setAssignTargetId("");
              }}
              disabled={isSubmitting}
            >
              {tc("buttons.cancel")}
            </Button>
            <Button
              onClick={handleAssign}
              disabled={isSubmitting || !assignTargetId}
            >
              {isSubmitting ? tc("buttons.loading") : t("schedules.assignTo")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateCard({
  template,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onAssign,
  formatTime,
}: {
  template: Template;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
  onAssign: (template: Template) => void;
  formatTime: (time: string) => string;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tt = useTranslations("time");

  const DAYS_OF_WEEK = useMemo(() => DAY_KEYS.map(day => ({
    value: day,
    label: tt(`weekdays.${day}`),
    short: tt(`weekdaysShort.${day}`),
  })), [tt]);

  // Group slots by day
  const slotsByDay = template.slots.reduce(
    (acc, slot) => {
      if (!acc[slot.dayOfWeek]) acc[slot.dayOfWeek] = [];
      acc[slot.dayOfWeek].push(slot);
      return acc;
    },
    {} as Record<string, typeof template.slots>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex size-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${template.color}20` }}
            >
              <CalendarBlank
                className="size-5"
                style={{ color: template.color || "#6366F1" }}
              />
            </div>
            <div>
              <CardTitle className="text-base">{template.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("schedules.assignmentCount", { count: template.assignmentCount })}
              </p>
            </div>
          </div>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <DotsThree className="size-4" weight="bold" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onAssign(template)}>
                  <UserPlus className="mr-2 size-4" />
                  {t("schedules.assignTo")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(template)}>
                  <PencilSimple className="mr-2 size-4" />
                  {tc("buttons.edit")}
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(template)}
                    >
                      <Trash className="mr-2 size-4" />
                      {tc("buttons.delete")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {template.description && (
          <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
            {template.description}
          </p>
        )}

        <div className="space-y-2">
          {DAYS_OF_WEEK.map((day) => {
            const slots = slotsByDay[day.value];
            if (!slots || slots.length === 0) return null;

            return (
              <div key={day.value} className="flex items-center gap-2 text-sm">
                <span className="w-10 font-medium text-muted-foreground">
                  {day.short}
                </span>
                <div className="flex flex-wrap gap-1">
                  {slots.map((slot, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="gap-1 font-normal"
                    >
                      {slot.crossesMidnight && <Moon className="size-3" />}
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full gap-2"
            onClick={() => onAssign(template)}
          >
            <UserPlus className="size-3" />
            {t("schedules.assignToTeam")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
