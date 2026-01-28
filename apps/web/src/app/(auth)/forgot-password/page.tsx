"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EnvelopeIcon,
  SpinnerGapIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { sendVerificationEmail } from "@/lib/auth-client";
import { toast } from "sonner";

type ForgotPasswordFormData = {
  email: string;
};

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.web.forgotPassword");
  const tv = useTranslations("auth.web.validation");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const forgotPasswordSchema = useMemo(
    () =>
      z.object({
        email: z.string().min(1, tv("emailRequired")).email(tv("emailInvalid")),
      }),
    [tv]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);

    try {
      const result = await sendVerificationEmail({
        email: data.email,
        callbackURL: "/reset-password",
      });

      if (result.error) {
        setError("root", {
          message: result.error.message || t("pleaseTryAgain"),
        });
        toast.error(t("requestFailed"), {
          description: result.error.message || t("pleaseTryAgain"),
        });
        setIsLoading(false);
        return;
      }

      setSubmittedEmail(data.email);
      setIsSuccess(true);
      toast.success(t("emailSent"), {
        description: t("checkInbox"),
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      setError("root", {
        message: t("pleaseTryAgain"),
      });
      toast.error(t("requestFailed"), {
        description: t("pleaseTryAgain"),
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
            <CheckCircleIcon
              className="size-8 text-green-600 dark:text-green-400"
              weight="bold"
            />
          </div>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("success.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("success.description")}{" "}
            <span className="font-medium text-foreground">
              {submittedEmail}
            </span>
          </p>
        </div>

        <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">
            {t("success.didntReceive")}
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>{t("success.checkSpam")}</li>
            <li>{t("success.checkEmail")}</li>
            <li>{t("success.waitAndRetry")}</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setIsSuccess(false);
              setSubmittedEmail("");
            }}
          >
            {t("success.tryDifferent")}
          </Button>

          <Link href="/login" className="block">
            <Button variant="ghost" className="w-full gap-2">
              <ArrowLeftIcon className="size-4" />
              {t("backToSignIn")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("backToSignIn")}
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {errors.root && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <WarningIcon className="size-4 shrink-0" weight="bold" />
          <p>{errors.root.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <div className="relative">
            <EnvelopeIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              className={`pl-9 ${
                errors.email
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }`}
              disabled={isLoading}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <SpinnerGapIcon className="size-4 animate-spin" />
              {t("sending")}
            </>
          ) : (
            t("sendLink")
          )}
        </Button>
      </form>
    </div>
  );
}
