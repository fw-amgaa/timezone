"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Lock,
  SpinnerGap,
  CheckCircle,
  ArrowLeft,
  Warning,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";
import { resetPassword } from "@/lib/auth-client";
import { toast } from "sonner";

type ResetPasswordFormData = {
  password: string;
  confirmPassword: string;
};

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const t = useTranslations("auth.web.resetPassword");
  const tv = useTranslations("auth.web.validation");

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetPasswordSchema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(1, tv("passwordRequired"))
            .min(8, tv("passwordMinLength", { count: 8 })),
          confirmPassword: z.string().min(1, tv("confirmPasswordRequired")),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t("passwordsDoNotMatch"),
          path: ["confirmPassword"],
        }),
    [t, tv]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!token) {
      toast.error(t("invalidLink.title"), {
        description: t("invalidLink.description"),
      });
    }
  }, [token, t]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setError("root", {
        message: t("invalidLink.description"),
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await resetPassword({
        newPassword: data.password,
        token,
      });

      if (result.error) {
        setError("root", {
          message: result.error.message || t("resetFailed"),
        });
        toast.error(t("resetFailed"), {
          description: result.error.message || t("resetFailed"),
        });
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      toast.success(t("success.title"), {
        description: t("success.description"),
      });
    } catch (error) {
      console.error("Reset password error:", error);
      setError("root", {
        message: t("resetFailed"),
      });
      toast.error(t("resetFailed"), {
        description: t("resetFailed"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="size-8 text-green-600 dark:text-green-400" weight="bold" />
          </div>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{t("success.title")}</h1>
          <p className="text-muted-foreground">{t("success.description")}</p>
        </div>

        <Link href="/login" className="block">
          <Button className="w-full">{t("success.continueToSignIn")}</Button>
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <Warning className="size-8 text-destructive" weight="bold" />
          </div>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{t("invalidLink.title")}</h1>
          <p className="text-muted-foreground">{t("invalidLink.description")}</p>
        </div>

        <Link href="/forgot-password" className="block">
          <Button className="w-full">{t("invalidLink.requestNewLink")}</Button>
        </Link>

        <Link href="/login" className="block">
          <Button variant="ghost" className="w-full gap-2">
            <ArrowLeft className="size-4" />
            {t("backToSignIn")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("backToSignIn")}
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {errors.root && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <Warning className="size-4 shrink-0" weight="bold" />
          <p>{errors.root.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">{t("newPassword")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("newPasswordPlaceholder")}
              className={`pl-9 pr-10 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
              disabled={isLoading}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeSlash className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder={t("confirmPasswordPlaceholder")}
              className={`pl-9 pr-10 ${errors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}`}
              disabled={isLoading}
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <EyeSlash className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <SpinnerGap className="size-4 animate-spin" />
              {t("resetting")}
            </>
          ) : (
            t("resetPassword")
          )}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <SpinnerGap className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
