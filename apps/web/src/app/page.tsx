import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Clock,
  MapPin,
  Users,
  ShieldCheck,
  ArrowRight,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";

const features = [
  {
    icon: Clock,
    title: "Midnight Shift Handling",
    description:
      "Seamlessly track shifts that cross midnight. Our algorithm links clock-in/out events intelligently, attributing hours to the correct work day.",
  },
  {
    icon: MapPin,
    title: "Precision Geofencing",
    description:
      "Server-side GPS verification prevents spoofing. Configurable radius per location with out-of-range request workflows.",
  },
  {
    icon: Users,
    title: "Multi-Tenant Architecture",
    description:
      "Each organization gets isolated data with custom settings, geofences, and approval workflows. Scale from startups to enterprises.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Ready",
    description:
      "Immutable audit trails, timezone-aware reporting, and automatic break calculations for labor law compliance.",
  },
];

const useCases = [
  "Hospitals & Healthcare",
  "Manufacturing",
  "Retail & Hospitality",
  "Construction",
  "Security Services",
  "Field Services",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
              <Clock className="size-5 text-primary-foreground" weight="bold" />
            </div>
            <span className="text-xl font-bold">TimeZone</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link
              href="#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Features
            </Link>
            <Link
              href="#use-cases"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Use Cases
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/register">
                Get Started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 to-transparent dark:from-primary-950/20" />
        <div className="container relative mx-auto px-4 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm">
              <span className="flex size-2 rounded-full bg-success animate-pulse" />
              Now with offline support
            </div>

            <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
              Time Tracking for{" "}
              <span className="bg-gradient-to-r from-primary to-primary-700 bg-clip-text text-transparent">
                High-Stakes
              </span>{" "}
              Environments
            </h1>

            <p className="mb-8 text-lg text-muted-foreground md:text-xl">
              Built for hospitals, factories, and anywhere shifts cross
              midnight. Precision geofencing, offline support, and approval
              workflows that actually work.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="xl" asChild>
                <Link href="/register">
                  Start Free Trial
                  <ArrowRight className="size-5" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link href="/demo">Watch Demo</Link>
              </Button>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              No credit card required. 14-day free trial.
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="border-t bg-muted/30 py-24">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Built for Real-World Complexity
            </h2>
            <p className="text-lg text-muted-foreground">
              Not just another time clock. Purpose-built features for complex
              scheduling.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border bg-card p-8 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="size-6" weight="duotone" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-24">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Trusted Across Industries
            </h2>
            <p className="text-lg text-muted-foreground">
              From 24/7 hospital shifts to multi-site construction crews.
            </p>
          </div>

          <div className="mx-auto max-w-3xl">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {useCases.map((useCase) => (
                <div
                  key={useCase}
                  className="flex items-center gap-3 rounded-lg border bg-card p-4"
                >
                  <CheckCircle
                    className="size-5 shrink-0 text-success"
                    weight="fill"
                  />
                  <span className="font-medium">{useCase}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-deep-bg py-24 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Ready to Modernize Your Time Tracking?
          </h2>
          <p className="mb-8 text-lg text-white/70">
            Join hundreds of organizations that trust TimeZone for accurate,
            compliant time tracking.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="xl"
              className="bg-white text-primary hover:bg-white/90"
              asChild
            >
              <Link href="/register">
                Start Free Trial
                <ArrowRight className="size-5" />
              </Link>
            </Button>
            <Button
              size="xl"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
              asChild
            >
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
                <Clock
                  className="size-4 text-primary-foreground"
                  weight="bold"
                />
              </div>
              <span className="font-bold">TimeZone</span>
            </div>

            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} TimeZone. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
