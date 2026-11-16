import type { Accessory } from '../src/shop';

export type ShopArt = Accessory | 'treats' | 'guard' | 'stones';
export const shopArtwork: Record<ShopArt, string> = {
  cap: `<path d="M48 88C48 39 66 24 103 24c39 0 57 19 57 65" fill="#6384F3"/><path d="M69 45q9-13 28-14M91 34l-7 47M128 34l8 47" fill="none" stroke="#9FB5FF" stroke-width="3" stroke-linecap="round"/><path d="M43 82q57 20 119 0l18 31q-75 32-156 0z" fill="#4B6FE7"/><path d="M46 85q56 18 114 0l3 10q-58 19-121 0z" fill="#3455C6"/><path d="M30 111q75 27 143 0" fill="none" stroke="#A6BAFF" stroke-width="2" stroke-dasharray="4 3"/><rect x="104" y="57" width="20" height="20" rx="5" fill="#EDF2FF"/><path d="M116 60q-11 3-7 13 12-3 7-13" fill="#6384F3"/>`,
  scarf: `<path d="m102 78-32 78 25 13 37-80M139 81l13 80 29-8-13-78" fill="#AA99CE"/><path d="m74 155-5 13m14-9-5 13m15-9-5 12m67-15 3 13m9-16 4 13m8-16 4 12" stroke="#AA99CE" stroke-width="6" stroke-linecap="round"/><ellipse cx="100" cy="65" rx="73" ry="32" fill="#AA99CE"/><ellipse cx="100" cy="56" rx="67" ry="25" fill="#F2EFF8" stroke="#B7A9D8" stroke-width="8"/><path d="M32 66q61 48 135 0M39 78q48 36 116 7m-70 48 22 10m-17-21 21 10m45 2 19-5m-17 16 18-5" fill="none" stroke="#D4C9E6" stroke-width="4" stroke-linecap="round"/><path d="m110 65 26 14-16 23-25-19z" fill="#BBACD8"/><path d="m108 70 19 14" stroke="#D4C9E6" stroke-width="4" stroke-linecap="round"/>`,
  goggles: `<path d="M14 73h172v26H14z" fill="#66788F"/><path d="M84 84q16-15 32 0" fill="none" stroke="#17212B" stroke-width="12"/><rect x="28" y="61" width="57" height="54" rx="22" fill="#17212B"/><rect x="115" y="61" width="57" height="54" rx="22" fill="#17212B"/><rect x="37" y="69" width="39" height="37" rx="15" fill="#ACC5DA"/><rect x="124" y="69" width="39" height="37" rx="15" fill="#ACC5DA"/><path d="m44 96 23-22m64 22 23-22" stroke="white" stroke-width="5" stroke-linecap="round"/>`,
  treats: `<path d="m68 35 65 2-9 30 22 82q4 17-14 17H65q-18 0-14-17l24-82z" fill="#C0B18A"/><path d="m68 35 65 2-9 30-49-1z" fill="#9E916F"/><path d="M76 67h47" stroke="#E5DCC3" stroke-width="7"/><rect x="68" y="92" width="60" height="51" rx="17" fill="#F8F3E6"/><path d="M99 102c-25 0-12 22 0 31 21-18 17-29 0-31" fill="#9E916F"/><path d="m143 50 15-6m-12 24 17 3" stroke="#2453FF" stroke-width="3" stroke-linecap="round"/>`,
  guard: `<path d="M100 24q28 17 58 20v56q0 40-58 70-58-30-58-70V44q30-3 58-20" fill="#C3D4F4"/><path d="M100 39q22 13 43 17v44q0 29-43 53-43-24-43-53V56q21-4 43-17" fill="#668BDD"/><path d="M100 54q15 9 28 11v35q0 21-28 39-28-18-28-39V65q13-2 28-11" fill="#4B73D0"/><path d="M113 72C79 65 72 91 86 119c17-8 31-26 27-47" fill="white"/>`,
  stones: `<ellipse cx="100" cy="158" rx="86" ry="10" fill="#DAE4ED"/><path d="M17 108q6-34 29-35 24-1 37 40 9 29-17 31H40q-29 0-23-36" fill="#91A3B9"/><path d="M66 65q8-32 30-32 26 0 35 37 6 24-23 27H90q-32 0-24-32" fill="#ACBACD"/><path d="M126 93q10-29 31-24 23 4 30 34 5 27-19 29h-26q-27-1-16-39" fill="#BAC8D7"/><path d="M58 133q8-27 29-24 21 2 30 31 7 25-19 25H77q-25-1-19-32" fill="#A9B8CB"/><path d="M123 140q4-24 26-20 23 5 32 28 7 18-19 18h-21q-24-1-18-26" fill="#91A3B9"/><path d="M34 89q12-8 21-2m29-36q12-8 22-2m39 34q12-2 16 8m-89 36q11-5 21 2m46 4q11 0 16 8" fill="none" stroke="#DDE5EF" stroke-width="4" stroke-linecap="round"/>`,
};

export function accessoryOverlay(item: Accessory, name: string) {
  const placement: Record<string, Record<Accessory, [number, number, number]>> = {
    Mochi: { cap: [160, -35, 1.5], scarf: [127, 169, 1.5], goggles: [154, 47, 1.6] },
    Pip: { cap: [177, 4, 1.12], scarf: [227, 200, 0.64], goggles: [221, 102, 0.8] },
    Button: { cap: [116, -90, 1.4], scarf: [78, 151, 1.8], goggles: [38, -49, 2.18] },
    Noodle: { cap: [203, -30, 0.8], scarf: [235, 126, 0.55], goggles: [222, 27, 0.7] },
    Puddle: { cap: [67, 33, 1.05], scarf: [28, 214, 1.1], goggles: [38, 125, 0.92] },
  };
  const [x, y, scale] = (placement[name] ?? placement.Mochi)[item];
  return `<g transform="translate(${x} ${y}) scale(${scale})">${item === 'scarf' ? shopArtwork[item].replace('#F2EFF8', '#B9C3D1') : shopArtwork[item]}</g>`;
}
