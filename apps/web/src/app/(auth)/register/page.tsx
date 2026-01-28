"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  GoogleLogo,
  GithubLogo,
  Envelope,
  Lock,
  User,
  Buildings,
  SpinnerGap,
  CheckCircle,
} from "@phosphor-icons/react";

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("auth.web.register");
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    orgName: "",
  });

  const features = useMemo(
    () => [
      t("features.freeTrial"),
      t("features.noCard"),
      t("features.cancelAnytime"),
    ],
    [t]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // TODO: Implement Better Auth registration
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsLoading(false);
    router.push("/onboarding");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-4">
        {features.map((feature) => (
          <div
            key={feature}
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <CheckCircle className="size-4 text-success" weight="fill" />
            {feature}
          </div>
        ))}
      </div>

      <div className="grid gap-3">
        <Button variant="outline" className="gap-2" disabled={isLoading}>
          <GoogleLogo className="size-4" weight="bold" />
          {t("continueWithGoogle")}
        </Button>
        <Button variant="outline" className="gap-2" disabled={isLoading}>
          <GithubLogo className="size-4" weight="bold" />
          {t("continueWithGithub")}
        </Button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t("orContinueWith")}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">{t("firstName")}</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="firstName"
                name="firstName"
                placeholder="John"
                value={formData.firstName}
                onChange={handleChange}
                className="pl-9"
                required
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">{t("lastName")}</Label>
            <Input
              id="lastName"
              name="lastName"
              placeholder="Doe"
              value={formData.lastName}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("workEmail")}</Label>
          <div className="relative">
            <Envelope className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="john@company.com"
              value={formData.email}
              onChange={handleChange}
              className="pl-9"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="orgName">{t("orgName")}</Label>
          <div className="relative">
            <Buildings className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="orgName"
              name="orgName"
              placeholder="Acme Inc."
              value={formData.orgName}
              onChange={handleChange}
              className="pl-9"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Create a strong password"
              value={formData.password}
              onChange={handleChange}
              className="pl-9"
              required
              minLength={8}
              disabled={isLoading}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <SpinnerGap className="size-4 animate-spin" />
              {t("creatingAccount")}
            </>
          ) : (
            t("createAccount")
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("signIn")}
        </Link>
      </p>

      <p className="text-center text-xs text-muted-foreground">
        {t("termsPrefix")}{" "}
        <Link href="/terms" className="underline hover:text-foreground">
          {t("termsOfService")}
        </Link>{" "}
        {t("and")}{" "}
        <Link href="/privacy" className="underline hover:text-foreground">
          {t("privacyPolicy")}
        </Link>
      </p>
    </div>
  );
}
