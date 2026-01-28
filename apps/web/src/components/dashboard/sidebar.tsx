"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  House,
  Users,
  UsersThree,
  ClockClockwise,
  MapPin,
  ChartLine,
  Gear,
  Bell,
  SignOut,
  CaretLeft,
  Buildings,
  ClipboardText,
  UserCircle,
  Moon,
  Sun,
  CalendarDots,
  Translate,
  Check,
} from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { signOut } from "@/lib/auth-client";
import { setLocale } from "@/i18n/actions";

const localeNames: Record<string, string> = {
  mn: "Монгол",
  en: "English",
};

const localeFlags: Record<string, string> = {
  mn: "\u{1F1F2}\u{1F1F3}",
  en: "\u{1F1FA}\u{1F1F8}",
};

// Role hierarchy for permission checks
type UserRole = "super_admin" | "org_admin" | "manager" | "employee";

const roleHierarchy: Record<UserRole, number> = {
  super_admin: 4,
  org_admin: 3,
  manager: 2,
  employee: 1,
};

const hasPermission = (userRole: string | undefined, requiredRole: UserRole): boolean => {
  const role = (userRole || "employee") as UserRole;
  return (roleHierarchy[role] || 0) >= roleHierarchy[requiredRole];
};

interface NavItem {
  titleKey: string;
  href: string;
  icon: any;
  badgeKey?: "pendingRequests" | "staleShifts";
  requiredRole?: UserRole;
}

const mainNavItems: NavItem[] = [
  {
    titleKey: "admin.dashboard",
    href: "/dashboard",
    icon: House,
  },
  {
    titleKey: "admin.employees",
    href: "/dashboard/employees",
    icon: Users,
    requiredRole: "manager",
  },
  {
    titleKey: "admin.timeEntries",
    href: "/dashboard/time-entries",
    icon: ClockClockwise,
    requiredRole: "manager",
  },
  {
    titleKey: "admin.requests",
    href: "/dashboard/requests",
    icon: ClipboardText,
    badgeKey: "pendingRequests",
    requiredRole: "manager",
  },
  {
    titleKey: "admin.teams",
    href: "/dashboard/teams",
    icon: UsersThree,
    requiredRole: "org_admin",
  },
  {
    titleKey: "admin.schedules",
    href: "/dashboard/schedules",
    icon: CalendarDots,
    requiredRole: "manager",
  },
  {
    titleKey: "admin.locations",
    href: "/dashboard/locations",
    icon: MapPin,
    requiredRole: "org_admin",
  },
  {
    titleKey: "admin.reports",
    href: "/dashboard/reports",
    icon: ChartLine,
    requiredRole: "manager",
  },
];

const adminNavItems: NavItem[] = [
  {
    titleKey: "admin.organizations",
    href: "/dashboard/organizations",
    icon: Buildings,
    requiredRole: "super_admin",
  },
  {
    titleKey: "admin.settings",
    href: "/dashboard/settings",
    icon: Gear,
    requiredRole: "org_admin",
  },
];

interface User {
  id: string;
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: string;
  image?: string | null;
}

interface BadgeCounts {
  pendingRequests?: number;
  staleShifts?: number;
}

interface SidebarProps {
  className?: string;
  user: User;
  badgeCounts?: BadgeCounts;
}

export function Sidebar({ className, user, badgeCounts = {} }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const locale = useLocale();
  const t = useTranslations("navigation");
  const ts = useTranslations("settings");
  const [isPending, startTransition] = useTransition();

  const handleLocaleChange = (newLocale: string) => {
    startTransition(() => {
      setLocale(newLocale);
    });
  };

  const displayName =
    user.name ||
    (user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.email);

  const initials =
    user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user.name
      ? user.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : user.email.slice(0, 2).toUpperCase();

  const roleDisplay = user.role
    ? user.role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : "Employee";

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "group/sidebar relative flex flex-col border-r bg-sidebar-background transition-all duration-300",
          collapsed ? "w-16" : "w-64",
          className
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-2 transition-opacity",
              collapsed && "opacity-0"
            )}
          >
            <Image
              src="/logo.png"
              alt="TimeZone"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-bold">TimeZone</span>
          </Link>

          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              "absolute -right-3 top-6 z-10 size-6 rounded-full border bg-background shadow-sm opacity-0 transition-opacity group-hover/sidebar:opacity-100",
              collapsed && "rotate-180"
            )}
            onClick={() => setCollapsed(!collapsed)}
          >
            <CaretLeft className="size-3" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            {mainNavItems
              .filter((item) => !item.requiredRole || hasPermission(user.role, item.requiredRole))
              .map((item) => {
              const isActive = pathname === item.href;
              const badgeCount = item.badgeKey
                ? badgeCounts[item.badgeKey]
                : undefined;
              const NavItem = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-5 shrink-0",
                      isActive && "text-primary"
                    )}
                    weight={isActive ? "fill" : "regular"}
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{t(item.titleKey)}</span>
                      {badgeCount !== undefined && badgeCount > 0 && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-white">
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{NavItem}</TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="flex items-center gap-2"
                    >
                      {t(item.titleKey)}
                      {badgeCount !== undefined && badgeCount > 0 && (
                        <span className="flex size-4 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-white">
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return NavItem;
            })}

            {adminNavItems.filter((item) => !item.requiredRole || hasPermission(user.role, item.requiredRole)).length > 0 && (
              <Separator className="my-4" />
            )}

            {adminNavItems
              .filter((item) => !item.requiredRole || hasPermission(user.role, item.requiredRole))
              .map((item) => {
              const isActive = pathname === item.href;
              const NavItem = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-5 shrink-0",
                      isActive && "text-primary"
                    )}
                    weight={isActive ? "fill" : "regular"}
                  />
                  {!collapsed && <span>{t(item.titleKey)}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{NavItem}</TooltipTrigger>
                    <TooltipContent side="right">{t(item.titleKey)}</TooltipContent>
                  </Tooltip>
                );
              }

              return NavItem;
            })}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 px-3",
                  collapsed && "justify-center px-0"
                )}
              >
                <Avatar className="size-8">
                  {user.image && <AvatarImage src={user.image} />}
                  <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex flex-1 flex-col items-start text-left">
                    <span className="text-sm font-medium">{displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {roleDisplay}
                    </span>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {displayName}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserCircle className="mr-2 size-4" />
                {t("main.profile")}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell className="mr-2 size-4" />
                {ts("notifications.title")}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Gear className="mr-2 size-4" />
                {t("admin.settings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <Sun className="mr-2 size-4" />
                ) : (
                  <Moon className="mr-2 size-4" />
                )}
                {theme === "dark"
                  ? ts("appearance.themes.light")
                  : ts("appearance.themes.dark")}
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Translate className="mr-2 size-4" />
                  {ts("language.title")}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {Object.entries(localeNames).map(([code, name]) => (
                      <DropdownMenuItem
                        key={code}
                        onClick={() => handleLocaleChange(code)}
                        disabled={isPending}
                      >
                        <span className="mr-2">{localeFlags[code]}</span>
                        {name}
                        {locale === code && (
                          <Check className="ml-auto size-4" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleSignOut}
              >
                <SignOut className="mr-2 size-4" />
                {t("actions.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
}
