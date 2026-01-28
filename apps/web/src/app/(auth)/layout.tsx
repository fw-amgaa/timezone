import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left side - Branding */}
      <div className="relative hidden bg-deep-bg lg:block">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent" />
        <div className="relative flex h-full flex-col p-10">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="TimeZone"
              width={44}
              height={44}
              className="rounded-lg"
            />
            <span className="text-2xl font-bold text-white">TimeZone</span>
          </Link>

          <div className="mt-auto">
            <blockquote className="space-y-4">
              <p className="text-xl text-white/90">
                &ldquo;TimeZone transformed how we handle overnight shifts.
                Clock-ins that span midnight are now tracked seamlessly, and our
                payroll team loves the accurate reports.&rdquo;
              </p>
              <footer className="text-white/70">
                <p className="font-semibold text-white">Sarah Chen</p>
                <p>HR Director, Metro General Hospital</p>
              </footer>
            </blockquote>
          </div>

          <div className="mt-8 flex gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1.5 w-8 rounded-full ${
                  i === 1 ? "bg-white" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <Image
              src="/logo.png"
              alt="TimeZone"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="text-xl font-bold">TimeZone</span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
