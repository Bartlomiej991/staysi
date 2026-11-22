// STAYSI: delikatne rysunki kreską w tle (kraj języka i temat lekcji).
// Proste, własne szkice: cienka linia w kolorze akcentu, półprzezroczyste, nie zasłaniają tekstu.

const arches = (y, n, x0, w) => Array.from({ length: n }, (_, i) => { const x = x0 + i * w; return `M${x + 2} ${y}v-7a${w / 2 - 2} ${w / 2 - 2} 0 0 1 ${w - 4} 0v7`; }).join("");
const spire = (x, top) => `M${x - 7} 108L${x - 3} ${top + 14}Q${x} ${top} ${x + 3} ${top + 14}L${x + 7} 108`;

const LAND = {
  // Brama Brandenburska
  de: `M8 106H112M16 50h88v10H16zM34 38h52v12H34zM52 38l4-11h8l4 11M56 27l-4-6M64 27l4-6
       M22 60v46M34 60v46M46 60v46M74 60v46M86 60v46M98 60v46`,
  // Wieża Eiffla
  fr: `M28 108C44 80 52 54 56 20M92 108C76 80 68 54 64 20M56 20l4-14 4 14M40 86h40M49 58h22M54 36h12
       M44 108q16-20 32 0M10 108h100`,
  // Koloseum
  it: `M10 104V46q50-14 100 0v58M10 60q50-12 100 0M10 78q50-10 100 0M8 104h104
       ${arches(104, 9, 12, 11)}${arches(78, 9, 12, 11)}${arches(60, 9, 12, 11)}`,
  // Big Ben
  en: `M46 48h28v58H46zM42 28h36v20H42zM44 28l16-24 16 24M60 31a7 7 0 1 0 .01 0M60 38v-5M60 38l4 2
       M53 56v44M60 56v44M67 56v44M20 106h80`,
  // Sagrada Família i słońce
  es: `${spire(30, 34)}${spire(48, 16)}${spire(72, 12)}${spire(90, 30)}M14 108h92M102 22a8 8 0 1 0 .01 0
       M38 80h44M38 92h44`,
  // Pałac Kultury
  pl: `M20 80h80v26H20zM32 62h56v18H32zM42 46h36v16H42zM50 32h20v14H50zM60 32V6
       M30 86v16M40 86v16M50 86v16M60 86v16M70 86v16M80 86v16M90 86v16M10 106h100`
};

const TOPIC = {
  food: `M34 48h44v26a22 22 0 0 1-44 0zM78 56a10 10 0 0 1 0 20M48 38q-5-6 0-12M60 38q-5-6 0-12M26 102h64`,
  travel: `M28 46h64v50H28zM48 46v-9h24v9M28 62h64M44 96v6M76 96v6`,
  work: `M30 36h60v38H30zM20 82h80l-6 10H26z`,
  home: `M22 60l38-30 38 30M30 54v46h60V54M52 100V76h16v24`,
  shopping: `M32 46h56l-5 56H37zM48 46a12 12 0 0 1 24 0`,
  errands: `M36 24h36l12 12v66H36zM72 24v12h12M46 52h28M46 64h28M46 76h18`,
  hobbies: `M60 36a30 30 0 1 0 .01 0M60 36v60M30 66h60M40 44q20 22 40 0M40 88q20-22 40 0`,
  tech: `M42 22h36v76H42zM56 30h8M60 88a2 2 0 1 0 .01 0`,
  culture: `M60 44C50 38 34 38 24 42v54c10-4 26-4 36 2 10-6 26-6 36-2V42c-10-4-26-4-36 2zM60 44v54`,
  relationships: `M18 34h50v30H40l-10 10V64H18zM56 70h46v28h-8v10l-10-10H56z`,
  education: `M18 52l42-16 42 16-42 16zM34 60v20c14 10 38 10 52 0V60M102 52v24`,
  nature: `M12 102l32-50 20 30 16-22 28 42zM86 22a9 9 0 1 0 .01 0`,
  health: `M60 96C22 72 24 40 44 40c10 0 16 10 16 10s6-10 16-10c20 0 22 32-16 56z`,
  society: `M40 44a10 10 0 1 0 .01 0M80 44a10 10 0 1 0 .01 0M22 96c0-18 10-28 18-28s18 10 18 28M62 96c0-18 10-28 18-28s18 10 18 28`
};

// cls: "scene" (duży, w rogu nagłówka) albo "scene sm" (mały, przy kafelku)
export function scene(lang, topic, cls = "scene") {
  const d = (topic && TOPIC[topic]) || LAND[lang];
  if (!d) return "";
  return `<svg class="${cls}" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><path d="${d.replace(/\s+/g, " ")}"/></svg>`;
}
export const landmark = (lang, cls) => scene(lang, null, cls);
