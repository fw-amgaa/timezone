"use client";

import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Users,
  Plus,
  DotsThree,
  PencilSimple,
  Trash,
  UserPlus,
  Info,
  UsersThree,
} from "@phosphor-icons/react";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  createdAt: string;
  memberCount: number;
}

interface Employee {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  role: string;
  isActive: boolean;
}

interface TeamsClientProps {
  teams: Team[];
  employees: Employee[];
  canEdit: boolean;
  canDelete: boolean;
}

const TEAM_COLORS = [
  "#6366F1", // Indigo
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#EF4444", // Red
  "#F97316", // Orange
  "#EAB308", // Yellow
  "#22C55E", // Green
  "#14B8A6", // Teal
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
];

export function TeamsClient({
  teams,
  employees,
  canEdit,
  canDelete,
}: TeamsClientProps) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteTeam, setDeleteTeam] = useState<Team | null>(null);
  const [manageMembersTeam, setManageMembersTeam] = useState<Team | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: TEAM_COLORS[0],
    memberIds: [] as string[],
  });

  const [teamMembers, setTeamMembers] = useState<string[]>([]);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      color: TEAM_COLORS[0],
      memberIds: [],
    });
    setEditingTeam(null);
  };

  const openEditDialog = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || "",
      color: team.color || TEAM_COLORS[0],
      memberIds: [],
    });
    setIsDialogOpen(true);
  };

  const openManageMembers = async (team: Team) => {
    setManageMembersTeam(team);
    setSearchQuery("");

    // Fetch current team members
    try {
      const response = await fetch(`/api/teams/${team.id}`);
      const result = await response.json();
      if (result.success) {
        setTeamMembers(result.team.members.map((m: any) => m.id));
      }
    } catch {
      toast.error("Failed to load team members");
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Team name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingTeam ? `/api/teams/${editingTeam.id}` : "/api/teams";
      const method = editingTeam ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          color: formData.color,
          memberIds: editingTeam ? undefined : formData.memberIds,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          editingTeam ? "Team updated successfully" : "Team created successfully"
        );
        setIsDialogOpen(false);
        resetForm();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to save team");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTeam) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/teams/${deleteTeam.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Team deleted successfully");
        setDeleteTeam(null);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete team");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMemberToggle = async (userId: string, isCurrentMember: boolean) => {
    if (!manageMembersTeam) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/teams/${manageMembersTeam.id}/members`, {
        method: isCurrentMember ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [userId] }),
      });

      const result = await response.json();

      if (result.success) {
        if (isCurrentMember) {
          setTeamMembers((prev) => prev.filter((id) => id !== userId));
        } else {
          setTeamMembers((prev) => [...prev, userId]);
        }
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update member");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.isActive &&
      (emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.position?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("teams.title")}</h1>
          <p className="text-muted-foreground">
            {t("teams.subtitle")}
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
                {t("teams.createTeam")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingTeam ? t("teams.editTeam") : t("teams.createTeam")}
                </DialogTitle>
                <DialogDescription>
                  {editingTeam
                    ? t("teams.editTeam")
                    : t("teams.subtitle")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("teams.teamName")} *</Label>
                  <Input
                    id="name"
                    placeholder={t("teams.teamNamePlaceholder")}
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t("teams.description")}</Label>
                  <Input
                    id="description"
                    placeholder={t("teams.descriptionPlaceholder")}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("teams.color")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {TEAM_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`size-8 rounded-full transition-all ${
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

                {!editingTeam && (
                  <div className="space-y-2">
                    <Label>Initial Members</Label>
                    <ScrollArea className="h-48 rounded-md border p-2">
                      {employees
                        .filter((emp) => emp.isActive)
                        .map((emp) => (
                          <div
                            key={emp.id}
                            className="flex items-center gap-3 rounded p-2 hover:bg-muted"
                          >
                            <Checkbox
                              id={`emp-${emp.id}`}
                              checked={formData.memberIds.includes(emp.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({
                                    ...formData,
                                    memberIds: [...formData.memberIds, emp.id],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    memberIds: formData.memberIds.filter(
                                      (id) => id !== emp.id
                                    ),
                                  });
                                }
                              }}
                            />
                            <Avatar className="size-8">
                              <AvatarFallback className="text-xs">
                                {emp.firstName[0]}
                                {emp.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{emp.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {emp.position || emp.role}
                              </p>
                            </div>
                          </div>
                        ))}
                    </ScrollArea>
                    {formData.memberIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formData.memberIds.length} member(s) selected
                      </p>
                    )}
                  </div>
                )}
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
                    : editingTeam
                      ? t("teams.editTeam")
                      : t("teams.createTeam")}
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
                Team-based Scheduling
              </p>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                Teams allow you to assign schedule templates to groups of
                employees at once. When you assign a schedule to a team, all
                members will automatically follow that schedule.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teams Grid */}
      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UsersThree className="mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">{t("teams.noTeams")}</h3>
            <p className="mb-4 text-center text-muted-foreground">
              {t("teams.createFirst")}
            </p>
            {canEdit && (
              <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                <Plus className="size-4" />
                {t("teams.createTeam")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={openEditDialog}
              onDelete={setDeleteTeam}
              onManageMembers={openManageMembers}
              t={t}
              tc={tc}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTeam}
        onOpenChange={() => setDeleteTeam(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("teams.deleteTeam")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("teams.confirmDelete")}
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

      {/* Manage Members Dialog */}
      <Dialog
        open={!!manageMembersTeam}
        onOpenChange={(open) => {
          if (!open) {
            setManageMembersTeam(null);
            setSearchQuery("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("teams.members")}</DialogTitle>
            <DialogDescription>
              {t("teams.addMember")} / {t("teams.removeMember")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder={t("employees.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <ScrollArea className="h-72">
              <div className="space-y-1">
                {filteredEmployees.map((emp) => {
                  const isMember = teamMembers.includes(emp.id);
                  return (
                    <div
                      key={emp.id}
                      className={`flex items-center gap-3 rounded-lg p-3 cursor-pointer transition-colors ${
                        isMember
                          ? "bg-primary/10 hover:bg-primary/20"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => handleMemberToggle(emp.id, isMember)}
                    >
                      <Checkbox
                        checked={isMember}
                        onCheckedChange={() =>
                          handleMemberToggle(emp.id, isMember)
                        }
                      />
                      <Avatar className="size-9">
                        <AvatarFallback
                          style={{
                            backgroundColor: isMember
                              ? manageMembersTeam?.color || "#6366F1"
                              : undefined,
                            color: isMember ? "white" : undefined,
                          }}
                        >
                          {emp.firstName[0]}
                          {emp.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {emp.position || emp.role}
                        </p>
                      </div>
                      {isMember && (
                        <Badge variant="secondary" className="text-xs">
                          {t("teams.roles.member")}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <p className="text-center text-sm text-muted-foreground">
              {t("teams.memberCount", { count: teamMembers.length })}
            </p>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setManageMembersTeam(null);
                setSearchQuery("");
              }}
            >
              {tc("buttons.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamCard({
  team,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onManageMembers,
  t,
  tc,
}: {
  team: Team;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (team: Team) => void;
  onDelete: (team: Team) => void;
  onManageMembers: (team: Team) => void;
  t: ReturnType<typeof useTranslations<"dashboard">>;
  tc: ReturnType<typeof useTranslations<"common">>;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex size-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${team.color}20` }}
            >
              <Users
                className="size-5"
                style={{ color: team.color || "#6366F1" }}
              />
            </div>
            <div>
              <CardTitle className="text-base">{team.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("teams.memberCount", { count: team.memberCount })}
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
                <DropdownMenuItem onClick={() => onManageMembers(team)}>
                  <UserPlus className="mr-2 size-4" />
                  {t("teams.members")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(team)}>
                  <PencilSimple className="mr-2 size-4" />
                  {t("teams.editTeam")}
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(team)}
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
        {team.description && (
          <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
            {team.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div
              className="size-3 rounded-full"
              style={{ backgroundColor: team.color || "#6366F1" }}
            />
            <span className="text-xs text-muted-foreground">
              {team.isActive ? tc("status.active") : tc("status.inactive")}
            </span>
          </div>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => onManageMembers(team)}
            >
              <UserPlus className="size-3" />
              {t("teams.members")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
