import { Layout } from "@/components/shop/Layout";

export default function License() {
  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-5 py-14 leading-relaxed">
        <h1 className="font-display text-4xl sm:text-5xl">Personal-use license</h1>
        <p className="mt-4 text-foreground/80">When you buy a planner you are buying a license to use that file, not the design itself. The design, artwork and text remain the property of Sara Hassan Abu Stita.</p>
        <h2 className="font-display text-2xl mt-10">You may</h2>
        <ul className="mt-2 list-disc pl-5 space-y-1 text-foreground/80">
          <li>Use the planner yourself, on paper or digitally.</li>
          <li>Print up to 2 copies for your own use.</li>
          <li>Re-download your file within your download window.</li>
        </ul>
        <h2 className="font-display text-2xl mt-10">You may not</h2>
        <ul className="mt-2 list-disc pl-5 space-y-1 text-foreground/80">
          <li>Share, give away, upload or resell the file or any part of it.</li>
          <li>Remove the licence line, your name or the order reference.</li>
          <li>Use the planner or its design for commercial purposes.</li>
        </ul>
        <h2 className="font-display text-2xl mt-10">Your copy is traceable</h2>
        <p className="mt-2 text-foreground/80">Each file carries your name and order reference. If a copy appears where it should not, we can identify the order it came from and close that account.</p>
        <h2 className="font-display text-2xl mt-10">Refunds</h2>
        <p className="mt-2 text-foreground/80">Because the file is personalised and delivered instantly, purchases are final once downloaded. If your file will not open or something is wrong with it, contact us and we will fix it or refund you.</p>
      </div>
    </Layout>
  );
}
