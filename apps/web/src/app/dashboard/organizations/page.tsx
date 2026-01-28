"use client";

import { useState, useEffect, useTransition } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  MagnifyingGlass,
  Plus,
  DotsThree,
  Pencil,
  Trash,
  Buildings,
  Envelope,
  Phone,
  User,
  MapPin,
  Users,
  CheckCircle,
  XCircle,
  Power,
  Eye,
} from "@phosphor-icons/react";
import {
  getOrganizations,
  createOrganization,
  toggleOrganizationStatus,
  deleteOrganization,
  type CreateOrgInput,
} from "@/lib/actions/organizations";

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: string | null;
  longitude: string | null;
  subscriptionTier: string | null;
  maxEmployees: number | null;
  isActive: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  adminCount: number;
  employeeCount: number;
}

function getStatusBadge(isActive: boolean | null) {
  if (isActive) {
    return <Badge variant="success">Active</Badge>;
  }
  return <Badge variant="muted">Inactive</Badge>;
}

function getTierBadge(tier: string | null) {
  switch (tier) {
    case "enterprise":
      return <Badge className="bg-purple-500">Enterprise</Badge>;
    case "professional":
      return <Badge className="bg-blue-500">Professional</Badge>;
    case "starter":
      return <Badge variant="secondary">Starter</Badge>;
    default:
      return <Badge variant="outline">Free</Badge>;
  }
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    subscriptionTier: "free" as const,
    maxEmployees: 10,
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPhone: "",
    adminPosition: "",
  });

  // Load organizations on mount
  useEffect(() => {
    loadOrganizations();
  }, []);

  async function loadOrganizations() {
    setLoading(true);
    const result = await getOrganizations();
    if (result.success && result.organizations) {
      setOrganizations(result.organizations as Organization[]);
    } else {
      toast.error(result.error || "Failed to load organizations");
    }
    setLoading(false);
  }

  // Generate slug from name
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  // Handle form input change
  function handleInputChange(field: string, value: string | number) {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-generate slug when name changes
      if (field === "name" && !prev.slug) {
        updated.slug = generateSlug(value as string);
      }
      return updated;
    });
  }

  // Reset form
  function resetForm() {
    setFormData({
      name: "",
      slug: "",
      description: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      subscriptionTier: "free",
      maxEmployees: 10,
      adminFirstName: "",
      adminLastName: "",
      adminEmail: "",
      adminPhone: "",
      adminPosition: "",
    });
  }

  // Handle create organization
  async function handleCreate() {
    const input: CreateOrgInput = {
      name: formData.name,
      slug: formData.slug || undefined,
      description: formData.description || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      website: formData.website || undefined,
      address: formData.address || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      country: formData.country || undefined,
      postalCode: formData.postalCode || undefined,
      subscriptionTier: formData.subscriptionTier,
      maxEmployees: formData.maxEmployees,
      admin: {
        firstName: formData.adminFirstName,
        lastName: formData.adminLastName,
        email: formData.adminEmail,
        phone: formData.adminPhone || undefined,
        position: formData.adminPosition || undefined,
      },
    };

    startTransition(async () => {
      const result = await createOrganization(input);
      if (result.success) {
        toast.success(result.message);
        setIsAddOpen(false);
        resetForm();
        loadOrganizations();
      } else {
        toast.error(result.error || "Failed to create organization");
      }
    });
  }

  // Handle toggle status
  async function handleToggleStatus(org: Organization) {
    startTransition(async () => {
      const result = await toggleOrganizationStatus(org.id);
      if (result.success) {
        toast.success(result.message);
        loadOrganizations();
      } else {
        toast.error(result.error || "Failed to update status");
      }
    });
  }

  // Handle delete
  async function handleDelete() {
    if (!selectedOrg) return;

    startTransition(async () => {
      const result = await deleteOrganization(selectedOrg.id);
      if (result.success) {
        toast.success(result.message);
        setIsDeleteOpen(false);
        setSelectedOrg(null);
        loadOrganizations();
      } else {
        toast.error(result.error || "Failed to delete organization");
      }
    });
  }

  // Filter organizations
  const filteredOrgs = organizations.filter((org) => {
    const search = searchQuery.toLowerCase();
    return (
      org.name.toLowerCase().includes(search) ||
      org.slug.toLowerCase().includes(search) ||
      org.email?.toLowerCase().includes(search)
    );
  });

  // Stats
  const activeCount = organizations.filter((o) => o.isActive).length;
  const totalEmployees = organizations.reduce((sum, o) => sum + o.employeeCount, 0);
  const enterpriseCount = organizations.filter(
    (o) => o.subscriptionTier === "enterprise"
  ).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">
            Manage all organizations on the platform
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              Add Organization
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Organization</DialogTitle>
              <DialogDescription>
                Create a new organization and its admin account. An invitation
                email will be sent to the admin.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Organization Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Organization Details
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Organization Name <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Buildings className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="name"
                        placeholder="Acme Healthcare"
                        className="pl-9"
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      placeholder="acme-healthcare"
                      value={formData.slug}
                      onChange={(e) => handleInputChange("slug", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto-generated from name if left empty
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the organization..."
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="orgEmail">Organization Email</Label>
                    <div className="relative">
                      <Envelope className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="orgEmail"
                        type="email"
                        placeholder="contact@acme.com"
                        className="pl-9"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orgPhone">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="orgPhone"
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        className="pl-9"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 size-4 text-muted-foreground" />
                    <Input
                      id="address"
                      placeholder="123 Main Street"
                      className="pl-9"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="New York"
                      value={formData.city}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      placeholder="NY"
                      value={formData.state}
                      onChange={(e) => handleInputChange("state", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      placeholder="USA"
                      value={formData.country}
                      onChange={(e) => handleInputChange("country", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tier">Subscription Tier</Label>
                    <Select
                      value={formData.subscriptionTier}
                      onValueChange={(value) =>
                        handleInputChange("subscriptionTier", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxEmployees">Max Employees</Label>
                    <Input
                      id="maxEmployees"
                      type="number"
                      min={1}
                      value={formData.maxEmployees}
                      onChange={(e) =>
                        handleInputChange("maxEmployees", parseInt(e.target.value))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Admin Details */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Organization Admin
                </h3>
                <p className="text-xs text-muted-foreground">
                  This person will receive an invitation email with login
                  credentials (default password: 12345678).
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="adminFirstName">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="adminFirstName"
                        placeholder="John"
                        className="pl-9"
                        value={formData.adminFirstName}
                        onChange={(e) =>
                          handleInputChange("adminFirstName", e.target.value)
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminLastName">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="adminLastName"
                      placeholder="Doe"
                      value={formData.adminLastName}
                      onChange={(e) =>
                        handleInputChange("adminLastName", e.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminEmail">
                    Admin Email <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Envelope className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="adminEmail"
                      type="email"
                      placeholder="john@acme.com"
                      className="pl-9"
                      value={formData.adminEmail}
                      onChange={(e) =>
                        handleInputChange("adminEmail", e.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="adminPhone">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="adminPhone"
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        className="pl-9"
                        value={formData.adminPhone}
                        onChange={(e) =>
                          handleInputChange("adminPhone", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminPosition">Position</Label>
                    <Input
                      id="adminPosition"
                      placeholder="HR Manager"
                      value={formData.adminPosition}
                      onChange={(e) =>
                        handleInputChange("adminPosition", e.target.value)
                      }
                    />
                  </div>
                </div>
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
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  isPending ||
                  !formData.name ||
                  !formData.adminFirstName ||
                  !formData.adminLastName ||
                  !formData.adminEmail
                }
              >
                {isPending ? "Creating..." : "Create Organization"}
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
                <Buildings className="size-5" weight="duotone" />
              </div>
              <div>
                <p className="text-2xl font-bold">{organizations.length}</p>
                <p className="text-sm text-muted-foreground">
                  Total Organizations
                </p>
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
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <Users className="size-5" weight="duotone" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalEmployees}</p>
                <p className="text-sm text-muted-foreground">Total Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                <Buildings className="size-5" weight="duotone" />
              </div>
              <div>
                <p className="text-2xl font-bold">{enterpriseCount}</p>
                <p className="text-sm text-muted-foreground">Enterprise</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Organizations</CardTitle>
              <CardDescription>
                A list of all organizations on the platform
              </CardDescription>
            </div>
            <div className="relative w-72">
              <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
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
              <p className="text-muted-foreground">Loading organizations...</p>
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2">
              <Buildings className="size-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">No organizations found</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(true)}
              >
                Add your first organization
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                          <Buildings className="size-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{org.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {org.email || org.slug}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getTierBadge(org.subscriptionTier)}
                        <p className="text-xs text-muted-foreground">
                          Max: {org.maxEmployees} employees
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="font-medium">{org.employeeCount}</span>
                        <p className="text-xs text-muted-foreground">
                          {org.adminCount} admin(s)
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(org.isActive)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <DotsThree className="size-4" weight="bold" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Eye className="mr-2 size-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Pencil className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(org)}
                          >
                            <Power className="mr-2 size-4" />
                            {org.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setSelectedOrg(org);
                              setIsDeleteOpen(true);
                            }}
                          >
                            <Trash className="mr-2 size-4" />
                            Delete
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{selectedOrg?.name}</strong>? This action cannot be undone.
              All employees and data associated with this organization will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete Organization"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
