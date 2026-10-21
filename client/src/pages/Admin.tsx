import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { CoverPreview } from "@/components/shop/CoverPreview";
import { Layout, money } from "@/components/shop/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

const toBase64 = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1] ?? "");
  r.onerror = () => rej(new Error("Could not read the file"));
  r.readAsDataURL(f);
});

function NewProduct({ onDone }: { onDone: () => void }) {
  const upload = trpc.admin.upload.useMutation();
  const create = trpc.admin.createProduct.useMutation();
  const [f, setF] = useState({ title: "", slug: "", description: "", year: 2027, price: 12, x: 50, y: 82, size: 45, color: "#1B2A2B", above: false });
  const [pdf, setPdf] = useState<File | null>(null);
  const [img, setImg] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string | number | boolean) => setF(s => ({ ...s, [k]: v }));

  async function submit() {
    if (!pdf) return toast.error("Choose the master PDF");
    setBusy(true);
    try {
      const m = await upload.mutateAsync({ kind: "master", fileName: pdf.name, base64: await toBase64(pdf) });
      const pv = img ? await upload.mutateAsync({ kind: "preview", fileName: img.name, base64: await toBase64(img) }) : null;
      await create.mutateAsync({
        slug: f.slug, title: f.title, description: f.description, year: f.year, priceCents: Math.round(f.price * 100),
        baseFileKey: m.key, previewImageUrl: pv?.url ?? undefined, coverNameXPct: f.x, coverNameYPct: f.y, coverNameSizePermille: f.size, stampColor: f.color, mottoAbove: f.above,
      });
      toast.success("Planner added");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }
  const num = (k: string, label: string, min = 0, max = 100) => (
    <div className="space-y-1"><Label>{label}</Label><Input type="number" min={min} max={max} value={(f as any)[k]} onChange={e => set(k, Number(e.target.value))} /></div>
  );
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1"><Label>Title</Label><Input value={f.title} onChange={e => set("title", e.target.value)} placeholder="Medicine Planner 2027" /></div>
        <div className="space-y-1"><Label>URL slug</Label><Input value={f.slug} onChange={e => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="medicine-2027" /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Description</Label><Textarea rows={3} value={f.description} onChange={e => set("description", e.target.value)} /></div>
        {num("year", "Year", 2020, 2100)}
        <div className="space-y-1"><Label>Price (USD)</Label><Input type="number" min={0} step="0.5" value={f.price} onChange={e => set("price", Number(e.target.value))} /></div>
        <div className="space-y-1"><Label>Master PDF (private)</Label><Input type="file" accept="application/pdf" onChange={e => setPdf(e.target.files?.[0] ?? null)} /></div>
        <div className="space-y-1"><Label>Cover preview image (PNG/JPG)</Label><Input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0] ?? null; setImg(file); setImgUrl(file ? URL.createObjectURL(file) : null); }} /></div>
        {num("x", "Name position - across (%)")}
        {num("y", "Name position - down (%)")}
        {num("size", "Name size (per mille of page width)", 10, 120)}
        <div className="space-y-1"><Label>Name colour</Label><Input type="color" value={f.color} onChange={e => set("color", e.target.value)} className="h-10 p-1" /></div>
        <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.above} onChange={e => set("above", e.target.checked)} /> Put the buyer's motto line above the name</label>
        <div className="sm:col-span-2"><Button onClick={submit} disabled={busy || !f.title || !f.slug || !f.description}>{busy ? "Uploading..." : "Add planner"}</Button></div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2">Position preview - adjust until the sample name sits where you want it.</p>
        <CoverPreview image={imgUrl} title={f.title || "Title"} cfg={{ coverNameXPct: f.x, coverNameYPct: f.y, coverNameSizePermille: f.size, stampColor: f.color, mottoAbove: f.above }} name="Emma Johnson" motto="Plan the dream" />
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";
  const products = trpc.admin.products.useQuery(undefined, { enabled: isAdmin });
  const orders = trpc.admin.orders.useQuery(undefined, { enabled: isAdmin });
  const refresh = () => { utils.admin.products.invalidate(); utils.admin.orders.invalidate(); };
  const markPaid = trpc.admin.markPaid.useMutation({ onSuccess: refresh });
  const refund = trpc.admin.refund.useMutation({ onSuccess: refresh });
  const grant = trpc.admin.grantDownloads.useMutation({ onSuccess: () => { refresh(); toast.success("2 downloads added"); } });
  const setActive = trpc.admin.setProductActive.useMutation({ onSuccess: refresh });
  const [adding, setAdding] = useState(false);

  if (loading) return <Layout><p className="p-10">Loading...</p></Layout>;
  if (!user) return <Layout><div className="p-10"><p className="mb-4">Sign in to manage the shop.</p><Button onClick={() => startLogin()}>Sign in</Button></div></Layout>;
  if (!isAdmin) return <Layout><p className="p-10">This area is for the shop owner only.</p></Layout>;

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-5 py-10 space-y-14">
        <section>
          <div className="flex items-center justify-between"><h1 className="font-display text-4xl">Planners</h1><Button variant="outline" onClick={() => setAdding(a => !a)}>{adding ? "Close" : "Add a planner"}</Button></div>
          {adding && <div className="mt-6"><NewProduct onDone={() => { setAdding(false); refresh(); }} /></div>}
          <div className="mt-6 divide-y">
            {products.data?.map(p => (
              <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                <div><div className="font-medium">{p.title}</div><div className="text-sm text-muted-foreground">/{p.slug} - {money(p.priceCents, p.currency)} - {p.active ? "visible" : "hidden"}</div></div>
                <Button size="sm" variant="outline" onClick={() => setActive.mutate({ id: p.id, active: !p.active })}>{p.active ? "Hide" : "Show"}</Button>
              </div>
            ))}
            {products.data?.length === 0 && <p className="py-4 text-muted-foreground">No planners yet.</p>}
          </div>
        </section>

        <section>
          <h2 className="font-display text-4xl">Orders</h2>
          <div className="mt-6 divide-y">
            {orders.data?.map(o => (
              <div key={o.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">PL-{String(o.id).padStart(6, "0")} - {o.buyerName} <span className="text-muted-foreground font-normal">{o.buyerEmail}</span></div>
                  <div className="text-sm text-muted-foreground">{o.status} - {money(o.amountCents, o.currency)} - downloads {o.downloadsUsed}/{o.downloadsMax}</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(`${location.origin}/order/${o.accessToken}`); toast.success("Order link copied"); }}>Copy link</Button>
                  {o.status === "pending" && <Button size="sm" onClick={() => markPaid.mutate({ orderId: o.id, note: "manual" })}>Mark paid</Button>}
                  {o.status === "paid" && <Button size="sm" variant="outline" onClick={() => grant.mutate({ orderId: o.id, extra: 2 })}>+2 downloads</Button>}
                  {o.status === "paid" && <Button size="sm" variant="outline" onClick={() => confirm("Refund this order?") && refund.mutate({ orderId: o.id })}>Refund</Button>}
                </div>
              </div>
            ))}
            {orders.data?.length === 0 && <p className="py-4 text-muted-foreground">No orders yet.</p>}
          </div>
        </section>
      </div>
    </Layout>
  );
}
