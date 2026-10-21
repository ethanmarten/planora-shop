import { Link } from "wouter";
import type { ReactNode } from "react";

export const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

export function Layout({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className={dark ? "bg-[var(--brand-ink)] text-[var(--brand-warm)]" : "bg-[var(--brand-ink)] text-[var(--brand-warm)]"}>
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl tracking-wide">Planora</Link>
          <nav className="flex gap-6 text-sm">
            <Link href="/" className="opacity-80 hover:opacity-100">Shop</Link>
            <Link href="/license" className="opacity-80 hover:opacity-100">License</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-[var(--brand-ink)] text-[var(--brand-warm)]/70 text-sm">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row gap-3 justify-between">
          <span>Designed by Sara Hassan Abu Stita</span>
          <span>Digital downloads - for personal use only. <Link href="/license" className="underline">Read the license</Link></span>
        </div>
      </footer>
    </div>
  );
}
