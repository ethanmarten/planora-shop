import { Layout, money } from "@/components/shop/Layout";
import { CoverPreview } from "@/components/shop/CoverPreview";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import NotFound from "./NotFound";

export default function Planner() {
  const [, params] = useRoute("/planner/:slug");
  const [, navigate] = useLocation();
  const { data: p, isLoading, error } = trpc.catalog.bySlug.useQuery({ slug: params?.slug ?? "" }, { enabled: !!params?.slug });
  const create = trpc.orders.create.useMutation({
    onSuccess: r => navigate(`/order/${r.accessToken}`),
    onError: e => toast.error(e.message),
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [motto, setMotto] = useState("");
  const [agree, setAgree] = useState(false);

  if (error) return <NotFound />;
  if (isLoading || !p) return <Layout><p className="p-10 text-muted-foreground">Loading...</p></Layout>;

  const ok = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email) && agree;
  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14 grid gap-10 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-16">
        <div className="lg:sticky lg:top-8 self-start">
          <CoverPreview image={p.previewImageUrl} title={p.title} cfg={p} name={name.trim()} motto={motto.trim()} />
          <p className="mt-3 text-xs text-muted-foreground">Preview. Your name is placed on the cover of your PDF exactly like this.</p>
        </div>

        <div className="max-w-xl">
          <Link href="/" className="text-sm text-muted-foreground hover:underline">All planners</Link>
          <h1 className="font-display text-4xl sm:text-5xl mt-2 leading-tight">{p.title}</h1>
          <p className="mt-2 text-lg tabular-nums">{money(p.priceCents, p.currency)} <span className="text-sm text-muted-foreground">one-time, {p.year}{p.pageCount ? `, ${p.pageCount} pages` : ""}</span></p>
          <div className="mt-5 border-l-2 border-[var(--brand-teal)] pl-4 text-sm leading-relaxed">
            <p className="font-medium">How it arrives</p>
            <p className="text-foreground/75">A PDF of A4 sheets, two A5 pages on each. You print it, <strong>cut every sheet in half</strong>, and bind the pages into your own notebook. A tablet version (A5 pages) is included.</p>
          </div>
          <p className="mt-5 leading-relaxed text-foreground/80 whitespace-pre-line">{p.description}</p>

          <form className="mt-10 space-y-5" onSubmit={e => { e.preventDefault(); if (ok) create.mutate({ productId: p.id, name, email, motto: motto || undefined, acceptLicense: true }); }}>
            <h2 className="font-display text-2xl">Make it yours</h2>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name on the cover</Label>
              <Input id="name" value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Emma Johnson" autoComplete="name" />
              <p className="text-xs text-muted-foreground">Please use English letters (A-Z).</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motto">A short line under your name (optional)</Label>
              <Input id="motto" value={motto} maxLength={60} onChange={e => setMotto(e.target.value)} placeholder="Plan the dream. Make it real." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              <p className="text-xs text-muted-foreground">Used only for your order. Keep your order page link safe - it is how you download.</p>
            </div>
            <label className="flex items-start gap-3 text-sm leading-snug">
              <Checkbox checked={agree} onCheckedChange={v => setAgree(v === true)} className="mt-0.5" />
              <span>I understand this is a personal-use license: I may print up to 2 copies for myself, and I will not share or resell the file. <Link href="/license" className="underline">Read the license</Link></span>
            </label>
            <Button type="submit" size="lg" disabled={!ok || create.isPending} className="w-full sm:w-auto">
              {create.isPending ? "One moment..." : `Continue - ${money(p.priceCents, p.currency)}`}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
