import { Layout, money } from "@/components/shop/Layout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";
import NotFound from "./NotFound";

export default function Order() {
  const [, params] = useRoute("/order/:token");
  const token = params?.token ?? "";
  const { data: o, error, isLoading } = trpc.orders.get.useQuery({ token }, { enabled: !!token, refetchInterval: q => (q.state.data?.status === "pending" ? 5000 : false) });
  if (error) return <NotFound />;
  if (isLoading || !o) return <Layout><p className="p-10 text-muted-foreground">Loading...</p></Layout>;

  const expires = o.expiresAt ? new Date(o.expiresAt).toLocaleDateString("en-US", { dateStyle: "long" }) : null;
  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-5 py-14">
        <h1 className="font-display text-4xl sm:text-5xl leading-tight">
          {o.status === "paid" ? `Your planner is ready, ${o.buyerName.split(" ")[0]}.` : o.status === "refunded" ? "This order was refunded." : "Almost there."}
        </h1>
        <p className="mt-3 text-foreground/75">{o.product?.title} - {money(o.amountCents, o.currency)}</p>

        {o.status === "pending" && (
          <div className="mt-8 border-l-2 border-[var(--brand-teal)] pl-5 space-y-3">
            <p>Your order is waiting for payment. This page updates by itself once the payment is confirmed.</p>
            <p className="text-sm text-muted-foreground">Bookmark this page - it is your private link to your download.</p>
          </div>
        )}

        {o.status === "paid" && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg"><a href={`/api/download/${token}?format=a4`}>Download - print and cut (A4)</a></Button>
              <Button asChild size="lg" variant="outline"><a href={`/api/download/${token}?format=a5`}>Download - tablet (A5)</a></Button>
            </div>
            <div className="border-l-2 border-[var(--brand-teal)] pl-5 text-sm leading-relaxed space-y-1">
              <p className="font-medium">Making your notebook</p>
              <p>The print version is A4 sheets with two A5 pages on each. Print at 100% (Actual size), cut every sheet in half along the marks, keep the pages in order and bind them. The first sheet of the file explains it too.</p>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>{o.downloadsLeft} of {o.downloadsMax} downloads left{expires ? `, available until ${expires}` : ""} (both versions count).</li>
              <li>Your name {o.buyerMotto ? "and line are" : "is"} printed on the cover, and your order reference sits on every page.</li>
              <li>For personal use: print up to 2 copies for yourself. Please do not share or resell the file.</li>
            </ul>
            <p className="text-sm">Lost the file or changed devices? Keep this page and contact us - we can add downloads.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
