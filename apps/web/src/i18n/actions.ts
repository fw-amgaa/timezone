"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supportedLocales, type Locale } from "./request";

const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function setLocale(locale: string) {
  if (!supportedLocales.includes(locale as Locale)) {
    throw new Error(`Invalid locale: ${locale}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  // Revalidate all paths to reflect the new locale
  revalidatePath("/", "layout");
}
