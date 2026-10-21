import { Layout, money } from "@/components/shop/Layout";
import { CoverPreview } from "@/components/shop/CoverPreview";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

export default function Home() {
  const { data, isLoading } = trpc.catalog.list.useQuery();
  return (
    <Layout>
      <section className="bg-[var(--brand-ink)] text-[var(--brand-warm)]" style={{ backgroundImage: "radial-gradient(ellipse at 75% 20%, rgba(72,214,200,0.16), transparent 55%)" }}>
        <div className="mx-auto max-w-6xl px-5 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <h1 className="font-display text-5xl sm:text-7xl leading-[1.02] max-w-3xl">Your year, with your name already on the cover.</h1>
          <p className="mt-6 max-w-xl text-base sm:text-lg text-[var(--brand-warm)]/75 leading-relaxed">
            Annual planners for students and young professionals. Tell us whose it is, and we hand you a PDF made for that person - ready to print or fill in on a tablet.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="font-display text-3xl sm:text-4xl">The planners</h2>
        {isLoading && <p className="mt-8 text-muted-foreground">Loading...</p>}
        {data && data.length === 0 && <p className="mt-8 text-muted-foreground">New planners are being added. Please check back soon.</p>}
        <div className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map(p => (
            <Link key={p.id} href={`/planner/${p.slug}`} className="group block">
              <CoverPreview image={p.previewImageUrl} title={p.title} cfg={p} name="" />
              <div className="mt-4 flex items-baseline justify-between gap-4">
                <h3 className="font-display text-2xl group-hover:underline underline-offset-4">{p.title}</h3>
                <span className="text-sm tabular-nums">{money(p.priceCents, p.currency)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
