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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  MapPin,
  Plus,
  DotsThree,
  PencilSimple,
  Trash,
  MapTrifold,
  Star,
  Info,
  Buildings,
} from "@phosphor-icons/react";
import { toast } from "sonner";

interface Location {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  isPrimary: boolean;
  createdAt: string;
}

interface LocationsClientProps {
  locations: Location[];
  organizationId: string;
  canEdit: boolean;
}

export function LocationsClient({
  locations,
  organizationId,
  canEdit,
}: LocationsClientProps) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deleteLocation, setDeleteLocation] = useState<Location | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    radiusMeters: "200",
    isPrimary: false,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      latitude: "",
      longitude: "",
      radiusMeters: "200",
      isPrimary: false,
    });
    setEditingLocation(null);
  };

  const openEditDialog = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      address: location.address || "",
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      radiusMeters: location.radiusMeters.toString(),
      isPrimary: location.isPrimary,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Location name is required");
      return;
    }

    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      toast.error("Please enter a valid latitude (-90 to 90)");
      return;
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      toast.error("Please enter a valid longitude (-180 to 180)");
      return;
    }

    const radius = parseInt(formData.radiusMeters);
    if (isNaN(radius) || radius < 50 || radius > 5000) {
      toast.error("Radius must be between 50 and 5000 meters");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/locations", {
        method: editingLocation ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingLocation?.id,
          organizationId,
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          latitude: lat,
          longitude: lng,
          radiusMeters: radius,
          isPrimary: formData.isPrimary,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          editingLocation
            ? "Location updated successfully"
            : "Location added successfully"
        );
        setIsDialogOpen(false);
        resetForm();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to save location");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteLocation) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/locations?id=${deleteLocation.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Location deleted successfully");
        setDeleteLocation(null);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete location");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openInMaps = (location: Location) => {
    const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    window.open(url, "_blank");
  };

  const primaryLocation = locations.find((l) => l.isPrimary);
  const otherLocations = locations.filter((l) => !l.isPrimary);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("locations.title")}</h1>
          <p className="text-muted-foreground">
            {t("locations.subtitle")}
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
                {t("locations.addLocation")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingLocation ? t("locations.editLocation") : t("locations.addLocation")}
                </DialogTitle>
                <DialogDescription>
                  {t("locations.dialogDescription")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("locations.locationName")} *</Label>
                  <Input
                    id="name"
                    placeholder={t("locations.locationNamePlaceholder")}
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t("locations.address")}</Label>
                  <Input
                    id="address"
                    placeholder={t("locations.addressPlaceholder")}
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">{t("locations.latitude")} *</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      placeholder="e.g., 40.7128"
                      value={formData.latitude}
                      onChange={(e) =>
                        setFormData({ ...formData, latitude: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">{t("locations.longitude")} *</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      placeholder="e.g., -74.0060"
                      value={formData.longitude}
                      onChange={(e) =>
                        setFormData({ ...formData, longitude: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="radius">{t("locations.radius")} *</Label>
                  <Input
                    id="radius"
                    type="number"
                    min="50"
                    max="5000"
                    placeholder="200"
                    value={formData.radiusMeters}
                    onChange={(e) =>
                      setFormData({ ...formData, radiusMeters: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("locations.radiusHelp")}
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>{t("locations.isPrimary")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("locations.isPrimaryDescription")}
                    </p>
                  </div>
                  <Switch
                    checked={formData.isPrimary}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isPrimary: checked })
                    }
                  />
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
                    : editingLocation
                      ? t("locations.editLocation")
                      : t("locations.addLocation")}
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
                {t("locations.howItWorksTitle")}
              </p>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                {t("locations.howItWorksDescription")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locations List */}
      {locations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Buildings className="mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">{t("locations.noLocations")}</h3>
            <p className="mb-4 text-center text-muted-foreground">
              {t("locations.createFirst")}
            </p>
            {canEdit && (
              <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                <Plus className="size-4" />
                {t("locations.addLocation")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Primary Location First */}
          {primaryLocation && (
            <LocationCard
              location={primaryLocation}
              canEdit={canEdit}
              onEdit={openEditDialog}
              onDelete={setDeleteLocation}
              onOpenMaps={openInMaps}
            />
          )}
          {/* Other Locations */}
          {otherLocations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              canEdit={canEdit}
              onEdit={openEditDialog}
              onDelete={setDeleteLocation}
              onOpenMaps={openInMaps}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteLocation}
        onOpenChange={() => setDeleteLocation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("locations.deleteLocation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("locations.confirmDelete")}
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
    </div>
  );
}

function LocationCard({
  location,
  canEdit,
  onEdit,
  onDelete,
  onOpenMaps,
}: {
  location: Location;
  canEdit: boolean;
  onEdit: (location: Location) => void;
  onDelete: (location: Location) => void;
  onOpenMaps: (location: Location) => void;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");

  return (
    <Card className={location.isPrimary ? "border-primary/50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`flex size-10 items-center justify-center rounded-lg ${
                location.isPrimary
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {location.isPrimary ? (
                <Star className="size-5" weight="fill" />
              ) : (
                <MapPin className="size-5" />
              )}
            </div>
            <div>
              <CardTitle className="text-base">{location.name}</CardTitle>
              {location.isPrimary && (
                <Badge variant="default" className="mt-1">
                  {t("locations.isPrimary")}
                </Badge>
              )}
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
                <DropdownMenuItem onClick={() => onEdit(location)}>
                  <PencilSimple className="mr-2 size-4" />
                  {tc("buttons.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenMaps(location)}>
                  <MapTrifold className="mr-2 size-4" />
                  {t("locations.viewOnMap")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(location)}
                >
                  <Trash className="mr-2 size-4" />
                  {tc("buttons.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {location.address && (
          <p className="mb-3 text-sm text-muted-foreground">{location.address}</p>
        )}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="size-4" />
            <span>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex size-4 items-center justify-center rounded-full border-2 border-primary" />
            <span className="text-muted-foreground">
              {location.radiusMeters}m {t("locations.radiusUnit")}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full gap-2"
          onClick={() => onOpenMaps(location)}
        >
          <MapTrifold className="size-4" />
          {t("locations.viewOnMap")}
        </Button>
      </CardContent>
    </Card>
  );
}
