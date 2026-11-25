import type { Workspace } from "../domain/types";
import { workspaceSchema } from "../domain/schema";
import { resolveDna } from "../domain/brand-dna";
import { prepareCompositionSvg } from "./font-export";
import { compositionAsset } from "./composition";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const image = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
export async function buildBrandBook(
  input: Workspace,
  brandId: string,
  conceptId?: string,
  mode: "composition" | "original" = "composition",
): Promise<string> {
  const workspace = workspaceSchema.parse(input);
  const brand = workspace.brands.find((b) => b.id === brandId);
  if (!brand) throw new Error("Brand not found.");
  const concepts = workspace.concepts.filter((c) => c.brandId === brandId);
  const concept =
    concepts.find((c) => c.id === conceptId) ??
    concepts.find((c) => c.favorite) ??
    concepts[0];
  if (!concept)
    throw new Error(
      "Generate or select a concept before exporting a brand book.",
    );
  const dna = resolveDna(brandId, workspace.brands);
  const copy = brand.book ?? {};
  const original = mode === "original" && concept.raster;
  const hero =
    original ||
    image(
      await prepareCompositionSvg(concept.document, compositionAsset(concept)),
    );
  const variants = await Promise.all(
    (["stacked", "horizontal", "symbol", "wordmark"] as const).map(
      async (layout) => ({
        layout,
        url:
          original ||
          image(
            await prepareCompositionSvg(
              { ...concept.document, layout },
              compositionAsset(concept),
            ),
          ),
      }),
    ),
  );
  const specimen = image(
    await prepareCompositionSvg(
      {
        ...concept.document,
        symbolSource: "geometric",
        layout: "wordmark",
        showWordmark: true,
        showSymbol: false,
        showSlogan: true,
        text: "Aa Bb Cc 0123",
        slogan: dna.typography,
        fontFamily: dna.typography,
        wordmarkSize: 64,
        background: "#ffffff",
        primary: "#172538",
        monochrome: false,
      },
      undefined,
    ),
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(brand.name)} — Brand book</title><style>
 *{box-sizing:border-box}body{margin:0;background:#e8edf4;color:#172538;font:16px/1.6 system-ui,sans-serif}main{max-width:1120px;margin:auto}section{background:white;min-height:720px;margin:24px 0;padding:64px;page-break-after:always}h1{font-size:54px;line-height:1.1;letter-spacing:-.04em}h2{font-size:32px;margin:0 0 30px}h3{font-size:18px}p{max-width:68ch;white-space:pre-wrap}small,figcaption{color:#526279}figure{margin:0}img{max-width:100%;object-fit:contain}.hero{height:340px;width:100%}.variants,.swatches,.applications{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.variants img{height:210px;width:100%}.swatch{height:80px;border-radius:8px;border:1px solid #ccd4de}.swatches{grid-template-columns:repeat(3,minmax(0,1fr))}.specimen{height:200px;width:100%}.application{padding:30px;background:#f1f4f8;border-radius:12px;min-height:230px}.application img{width:100%;height:160px}.card{background:white;box-shadow:0 12px 35px #17253812;max-width:330px;margin:20px auto;padding:20px}.card img{height:100px}.web-header{background:white;display:flex;align-items:center;gap:16px;padding:15px}.web-header img{width:130px;height:70px}.icon{width:150px;height:150px;background:white;border-radius:30px;display:grid;place-items:center;margin:15px auto}.icon img{width:120px;height:120px}footer{font-size:12px;color:#526279;margin-top:35px}@media(max-width:700px){section{padding:28px;margin:12px;min-height:unset}h1{font-size:36px}.variants,.applications,.swatches{grid-template-columns:1fr}}@media print{body{background:white}main{max-width:none}section{margin:0;min-height:0;break-inside:avoid;padding:20mm}.variants,.applications{grid-template-columns:1fr 1fr}.swatches{grid-template-columns:repeat(3,1fr)}@page{size:A4 landscape;margin:0}}
 </style></head><body><main>
 <section><small>VISUAL IDENTITY</small><h1>${escape(copy.headline || brand.name)}</h1><img class="hero" src="${hero}" alt="${escape(brand.name)} logo"><p>${escape(copy.overview || `${brand.name} — visual identity`)}</p><footer>${escape(concept.name)} · ${original ? "Original image" : "Editable composition"} · Created with JavLogos</footer></section>
 <section><h2>${original ? "Original artwork" : "Logo system"}</h2><div class="variants">${variants.map((v) => `<figure><img src="${v.url}" alt="${escape(v.layout)} presentation"><figcaption>${original ? "Original image reference" : escape(v.layout)}</figcaption></figure>`).join("")}</div><p>Preserve the original proportions. Review small-size legibility before final use.</p></section>
 <section><h2>Color and typography</h2><div class="swatches">${dna.palette.map((color, i) => `<div><div class="swatch" style="background:${color}"></div><h3>${i === 0 ? "Primary" : i === 1 ? "Secondary" : `Accent ${i - 1}`}</h3><code>${color}</code></div>`).join("")}</div><img class="specimen" src="${specimen}" alt="${escape(dna.typography)} specimen"><p>Typeface: ${escape(dna.typography)}</p><p>${escape(copy.voice || dna.tone)}</p></section>
 <section><h2>In context</h2><div class="applications"><figure class="application"><div class="card"><img src="${hero}" alt="Logo on a card"><strong>${escape(brand.name)}</strong></div><figcaption>Business card · illustrative placement</figcaption></figure><figure class="application"><div class="web-header"><img src="${hero}" alt="Website header logo"><strong>${escape(brand.name)}</strong></div><figcaption>Website header · illustrative placement</figcaption></figure><figure class="application"><div class="icon"><img src="${hero}" alt="App icon placement"></div><figcaption>App icon · illustrative placement</figcaption></figure><figure class="application"><img src="${hero}" alt="Packaging logo placement"><figcaption>Packaging label · illustrative placement</figcaption></figure></div></section>
 <section><h2>Usage and delivery</h2><p>${escape(copy.usageNotes || "Use approved variants, maintain clear space around the mark and choose a background with sufficient contrast. Test the mark in monochrome and at its intended size.")}</p><h3>Source</h3><p>${escape(concept.provider)} · Seed ${concept.seed}</p><p>This book uses the selected artwork exactly. Mockups are illustrative templates. Typeface embedding supports browser display; external editors and print workflows require validation. This document does not certify trademark originality.</p><footer>Edit the book copy in JavLogos and export again. Open this local HTML in a browser and use Print / Save as PDF for a PDF copy.</footer></section>
 </main></body></html>`;
}
