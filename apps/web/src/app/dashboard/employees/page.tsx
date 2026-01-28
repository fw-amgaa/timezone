"use client";

import { useState, useEffect, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  MagnifyingGlass,
  Plus,
  DotsThree,
  Pencil,
  Trash,
  User,
  Phone,
  IdentificationCard,
  Briefcase,
  Clock,
  CheckCircle,
  XCircle,
  DeviceMobile,
} from "@phosphor-icons/react";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from "@/lib/actions/employees";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  registrationNumber: string | null;
  role: string;
  isActive: boolean | null;
  status: "clocked_in" | "clocked_out" | "inactive";
  hoursThisWeek: number;
  lastActive: string;
  hasPassword: boolean;
  phoneVerified: boolean | null;
  createdAt: Date;
}

function getStatusBadge(status: string, t: (key: string) => string) {
  switch (status) {
    case "clocked_in":
      return <Badge variant="success">{t("employees.status.clockedIn")}</Badge>;
    case "clocked_out":
      return <Badge variant="secondary">{t("employees.status.clockedOut")}</Badge>;
    case "inactive":
      return <Badge variant="muted">{t("employees.status.inactive")}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getRoleBadge(role: string, t: (key: string) => string) {
  switch (role) {
    case "org_manager":
      return <Badge variant="default">{t("employees.roles.manager")}</Badge>;
    case "org_admin":
      return <Badge>{t("employees.roles.admin")}</Badge>;
    default:
      return null;
  }
}

function getRegistrationBadge(hasPassword: boolean, phoneVerified: boolean | null, t: (key: string) => string) {
  if (hasPassword && phoneVerified) {
    return <Badge variant="success" className="text-xs">{t("employees.status.registered")}</Badge>;
  }
  return <Badge variant="outline" className="text-xs">{t("employees.status.pending")}</Badge>;
}

export default function EmployeesPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    position: "",
    registrationNumber: "",
    role: "employee" as "employee" | "org_manager",
  });

  // Load employees on mount
  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    setLoading(true);
    const result = await getEmployees();
    if (result.success && result.employees) {
      setEmployees(result.employees as Employee[]);
    } else {
      toast.error(result.error || "Failed to load employees");
    }
    setLoading(false);
  }

  // Handle form input change
  function handleInputChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  // Reset form
  function resetForm() {
    setFormData({
      firstName: "",
      lastName: "",
      phone: "",
      position: "",
      registrationNumber: "",
      role: "employee",
    });
  }

  // Open edit dialog with employee data
  function openEditDialog(employee: Employee) {
    setSelectedEmployee(employee);
    setFormData({
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone || "",
      position: employee.position || "",
      registrationNumber: employee.registrationNumber || "",
      role: employee.role === "org_manager" ? "org_manager" : "employee",
    });
    setIsEditOpen(true);
  }

  // Handle create employee
  async function handleCreate() {
    const input: CreateEmployeeInput = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      position: formData.position || undefined,
      registrationNumber: formData.registrationNumber || undefined,
      role: formData.role,
    };

    startTransition(async () => {
      const result = await createEmployee(input);
      if (result.success) {
        toast.success(result.message);
        setIsAddOpen(false);
        resetForm();
        loadEmployees();
      } else {
        toast.error(result.error || "Failed to create employee");
      }
    });
  }

  // Handle update employee
  async function handleUpdate() {
    if (!selectedEmployee) return;

    const input: UpdateEmployeeInput = {
      id: selectedEmployee.id,
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      position: formData.position || undefined,
      registrationNumber: formData.registrationNumber || undefined,
      role: formData.role,
    };

    startTransition(async () => {
      const result = await updateEmployee(input);
      if (result.success) {
        toast.success(result.message);
        setIsEditOpen(false);
        setSelectedEmployee(null);
        resetForm();
        loadEmployees();
      } else {
        toast.error(result.error || "Failed to update employee");
      }
    });
  }

  // Handle delete employee
  async function handleDelete() {
    if (!selectedEmployee) return;

    startTransition(async () => {
      const result = await deleteEmployee(selectedEmployee.id);
      if (result.success) {
        toast.success(result.message);
        setIsDeleteOpen(false);
        setSelectedEmployee(null);
        loadEmployees();
      } else {
        toast.error(result.error || "Failed to delete employee");
      }
    });
  }

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const search = searchQuery.toLowerCase();
    return (
      emp.firstName.toLowerCase().includes(search) ||
      emp.lastName.toLowerCase().includes(search) ||
      emp.phone?.toLowerCase().includes(search) ||
      emp.position?.toLowerCase().includes(search)
    );
  });

  // Stats
  const totalEmployees = employees.length;
  const clockedIn = employees.filter((e) => e.status === "clocked_in").length;
  const clockedOut = employees.filter((e) => e.status === "clocked_out").length;
  const totalHours = employees.reduce((acc, e) => acc + e.hoursThisWeek, 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("employees.title")}</h1>
          <p className="text-muted-foreground">
            {t("employees.subtitle")}
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              {t("employees.addEmployee")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t("employees.addNewEmployee")}</DialogTitle>
              <DialogDescription>
                {t("employees.addDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    {t("employees.fields.firstName")} <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="firstName"
                      placeholder="John"
                      className="pl-9"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    {t("employees.fields.lastName")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">
                  {t("employees.fields.phone")} <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="99001234"
                    className="pl-9"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("employees.fields.phoneDescription")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">{t("employees.fields.position")}</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="position"
                    placeholder="Registered Nurse"
                    className="pl-9"
                    value={formData.position}
                    onChange={(e) => handleInputChange("position", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="registrationNumber">
                  {t("employees.fields.registrationNumber")}
                </Label>
                <div className="relative">
                  <IdentificationCard className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="registrationNumber"
                    placeholder="RN-2024-0000"
                    className="pl-9"
                    value={formData.registrationNumber}
                    onChange={(e) =>
                      handleInputChange("registrationNumber", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">{t("employees.fields.role")}</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleInputChange("role", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("employees.fields.role")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">{t("employees.roles.employee")}</SelectItem>
                    <SelectItem value="org_manager">{t("employees.roles.manager")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddOpen(false);
                  resetForm();
                }}
              >
                {tc("buttons.cancel")}
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  isPending ||
                  !formData.firstName ||
                  !formData.lastName ||
                  !formData.phone
                }
              >
                {isPending ? tc("buttons.loading") : t("employees.addEmployee")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <User className="size-5" weight="duotone" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalEmployees}</p>
                <p className="text-sm text-muted-foreground">{t("employees.stats.totalEmployees")}</p>
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
                <p className="text-2xl font-bold">{clockedIn}</p>
                <p className="text-sm text-muted-foreground">{t("employees.stats.clockedIn")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <XCircle className="size-5" weight="duotone" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clockedOut}</p>
                <p className="text-sm text-muted-foreground">{t("employees.stats.clockedOut")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <Clock className="size-5" weight="duotone" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground">{t("employees.stats.hoursThisWeek")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employees Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("employees.allEmployees")}</CardTitle>
              <CardDescription>
                {t("employees.allEmployeesDesc")}
              </CardDescription>
            </div>
            <div className="relative w-72">
              <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("employees.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-muted-foreground">{t("employees.loading")}</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2">
              <User className="size-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">{t("employees.noEmployees")}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(true)}
              >
                {t("employees.createFirst")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("employees.fields.name")}</TableHead>
                  <TableHead>{t("employees.fields.position")}</TableHead>
                  <TableHead>{t("employees.fields.status")}</TableHead>
                  <TableHead>{t("employees.fields.hoursThisWeek")}</TableHead>
                  <TableHead>{t("employees.fields.lastActive")}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {employee.firstName[0]}
                            {employee.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {employee.firstName} {employee.lastName}
                            </span>
                            {getRoleBadge(employee.role, t)}
                            {getRegistrationBadge(
                              employee.hasPassword,
                              employee.phoneVerified,
                              t
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <DeviceMobile className="size-3" />
                            {employee.phone || t("employees.noPhone")}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{employee.position || "-"}</p>
                        {employee.registrationNumber && (
                          <p className="text-sm text-muted-foreground">
                            {employee.registrationNumber}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(employee.status, t)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{employee.hoursThisWeek}h</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.lastActive}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <DotsThree className="size-4" weight="bold" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{t("employees.actions.actions")}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <User className="mr-2 size-4" />
                            {t("employees.actions.viewProfile")}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Clock className="mr-2 size-4" />
                            {t("employees.actions.viewTimeEntries")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(employee)}>
                            <Pencil className="mr-2 size-4" />
                            {t("employees.actions.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setIsDeleteOpen(true);
                            }}
                          >
                            <Trash className="mr-2 size-4" />
                            {t("employees.actions.remove")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) {
          setSelectedEmployee(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("employees.editEmployee")}</DialogTitle>
            <DialogDescription>
              {t("employees.editDescription", {
                name: `${selectedEmployee?.firstName} ${selectedEmployee?.lastName}`,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">
                  {t("employees.fields.firstName")} <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="edit-firstName"
                    placeholder="John"
                    className="pl-9"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">
                  {t("employees.fields.lastName")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">
                {t("employees.fields.phone")} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="edit-phone"
                  type="tel"
                  placeholder="99001234"
                  className="pl-9"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("employees.fields.phoneDescription")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-position">{t("employees.fields.position")}</Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="edit-position"
                  placeholder="Registered Nurse"
                  className="pl-9"
                  value={formData.position}
                  onChange={(e) => handleInputChange("position", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-registrationNumber">
                {t("employees.fields.registrationNumber")}
              </Label>
              <div className="relative">
                <IdentificationCard className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="edit-registrationNumber"
                  placeholder="RN-2024-0000"
                  className="pl-9"
                  value={formData.registrationNumber}
                  onChange={(e) =>
                    handleInputChange("registrationNumber", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">{t("employees.fields.role")}</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleInputChange("role", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("employees.fields.role")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">{t("employees.roles.employee")}</SelectItem>
                  <SelectItem value="org_manager">{t("employees.roles.manager")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditOpen(false);
                setSelectedEmployee(null);
                resetForm();
              }}
            >
              {tc("buttons.cancel")}
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={
                isPending ||
                !formData.firstName ||
                !formData.lastName ||
                !formData.phone
              }
            >
              {isPending ? tc("buttons.loading") : tc("buttons.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("employees.removeEmployee")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("employees.confirmRemove", {
                name: `${selectedEmployee?.firstName} ${selectedEmployee?.lastName}`
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
            >
              {isPending ? tc("buttons.loading") : t("employees.removeEmployee")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
