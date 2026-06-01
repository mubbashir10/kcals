// Curated local food database. Server-side, zero-latency, no API.
//
// Two jobs:
//  1. Give common whole foods (apple, rice, egg, chicken) a clean,
//     brand-free "reference" hit that surfaces instantly and ranks above
//     the noisy branded results USDA/OFF return for the same query.
//  2. Cover South Asian / Pakistani home cooking (biryani, daal, roti,
//     karahi, nihari…) that USDA's Western dataset barely touches and OFF
//     only has as packaged products.
//
// All nutrition is per 100g of the food as typically eaten (cooked dishes
// are per 100g cooked). Values are rounded, real-world averages drawn from
// USDA SR, IFCT (Indian Food Composition Tables), and common label data —
// good enough for diary tracking, not lab-grade. `aliases` capture spelling
// variants and synonyms so "dal", "dhal", "daal" all hit the same row.

import type { UsdaFood } from "@/lib/usda";

export type LocalFood = {
  name: string;
  aliases?: string[];
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Natural single-unit weight, if the food has one (1 roti, 1 egg). */
  servingSizeG?: number;
  servingLabel?: string;
};

// Synthetic fdcId range for local rows. Sits below the AI-preview floor
// (-2e9) so it never collides with USDA (positive), CustomFood (-1 to
// -1e9), OFF (< -1e9), recipes (< -1e9), or AI previews (-2e9). This is a
// display-only React key, never persisted: it falls below PostgreSQL int4's
// minimum, so `persistableFdcId` drops it to null when a local food is
// logged (a logged food keeps its own nutrient snapshot, not a reference).
const LOCAL_FOOD_FLOOR = -3_000_000_000;

// --- South Asian / Pakistani ----------------------------------------------
const SOUTH_ASIAN: LocalFood[] = [
  // Rice & biryani
  { name: "Chicken Biryani", aliases: ["biriyani", "murgh biryani"], kcal: 165, proteinG: 8, carbsG: 20, fatG: 6 },
  { name: "Beef Biryani", aliases: ["mutton biryani", "gosht biryani", "biriyani"], kcal: 180, proteinG: 9, carbsG: 18, fatG: 8 },
  { name: "Vegetable Biryani", aliases: ["veg biryani", "biriyani", "sabzi biryani"], kcal: 140, proteinG: 3.5, carbsG: 22, fatG: 4.5 },
  { name: "Chicken Pulao", aliases: ["pilau", "pulav", "yakhni pulao"], kcal: 150, proteinG: 5, carbsG: 22, fatG: 4.5 },
  { name: "Matar Pulao", aliases: ["peas pulao", "pilau", "pulav"], kcal: 135, proteinG: 3, carbsG: 23, fatG: 3.5 },
  { name: "Boiled White Rice", aliases: ["plain rice", "chawal", "steamed rice", "basmati"], kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
  { name: "Zarda", aliases: ["sweet rice", "meethe chawal"], kcal: 280, proteinG: 4, carbsG: 50, fatG: 8 },
  { name: "Khichdi", aliases: ["khichri", "khichuri"], kcal: 120, proteinG: 4.5, carbsG: 20, fatG: 2.5 },

  // Daal & legumes
  { name: "Daal (Tarka)", aliases: ["dal", "dhal", "lentil curry", "masoor dal", "tadka"], kcal: 115, proteinG: 6, carbsG: 16, fatG: 3 },
  { name: "Daal Chana", aliases: ["dal", "chana dal", "split chickpea"], kcal: 120, proteinG: 6, carbsG: 18, fatG: 2.5 },
  { name: "Daal Mash", aliases: ["dal", "urad dal", "maash"], kcal: 130, proteinG: 7, carbsG: 17, fatG: 3.5 },
  { name: "Daal Moong", aliases: ["dal", "moong dal", "mung"], kcal: 105, proteinG: 6, carbsG: 16, fatG: 1.5 },
  { name: "Daal Makhani", aliases: ["dal makhani"], kcal: 145, proteinG: 6, carbsG: 15, fatG: 7 },
  { name: "Chana Masala (Chole)", aliases: ["chole", "chickpea curry", "chana curry", "channa"], kcal: 130, proteinG: 5, carbsG: 18, fatG: 4 },
  { name: "Rajma", aliases: ["kidney bean curry", "red bean curry"], kcal: 125, proteinG: 5, carbsG: 18, fatG: 3.5 },
  { name: "Murgh Cholay", aliases: ["chicken chana", "chicken chickpea"], kcal: 140, proteinG: 9, carbsG: 12, fatG: 6 },

  // Meat curries
  { name: "Chicken Karahi", aliases: ["karahi", "kadai chicken", "karhai"], kcal: 175, proteinG: 14, carbsG: 5, fatG: 11 },
  { name: "Chicken Curry (Salan)", aliases: ["murgh salan", "chicken salan", "shorba"], kcal: 150, proteinG: 12, carbsG: 5, fatG: 9 },
  { name: "Beef Curry", aliases: ["beef salan", "gosht salan", "mutton curry"], kcal: 190, proteinG: 14, carbsG: 4, fatG: 13 },
  { name: "Mutton Karahi", aliases: ["goat karahi", "gosht karahi", "karhai"], kcal: 195, proteinG: 14, carbsG: 5, fatG: 13 },
  { name: "Nihari", aliases: ["nehari"], kcal: 200, proteinG: 13, carbsG: 6, fatG: 14 },
  { name: "Haleem", aliases: ["khichra", "daleem"], kcal: 165, proteinG: 9, carbsG: 16, fatG: 7 },
  { name: "Chicken Korma", aliases: ["qorma", "murgh korma"], kcal: 190, proteinG: 12, carbsG: 6, fatG: 13 },
  { name: "Keema (Mince Curry)", aliases: ["qeema", "kheema", "minced meat"], kcal: 210, proteinG: 14, carbsG: 4, fatG: 15 },
  { name: "Aloo Keema", aliases: ["qeema aloo", "potato mince"], kcal: 170, proteinG: 10, carbsG: 10, fatG: 10 },
  { name: "Aloo Gosht", aliases: ["potato meat curry", "gosht"], kcal: 160, proteinG: 10, carbsG: 9, fatG: 9 },
  { name: "Kofta Curry", aliases: ["meatball curry"], kcal: 200, proteinG: 12, carbsG: 6, fatG: 14 },
  { name: "Paya (Trotters)", aliases: ["siri paya", "trotter curry"], kcal: 185, proteinG: 14, carbsG: 3, fatG: 13 },
  { name: "Tandoori Chicken", aliases: ["tandoori murgh"], kcal: 165, proteinG: 25, carbsG: 2, fatG: 7 },
  { name: "Chicken Tikka", aliases: ["tikka"], kcal: 150, proteinG: 22, carbsG: 2, fatG: 6 },

  // Kebabs & grills
  { name: "Seekh Kebab", aliases: ["seekh kabab", "sheekh"], kcal: 230, proteinG: 15, carbsG: 4, fatG: 17 },
  { name: "Chapli Kebab", aliases: ["chapli kabab"], kcal: 250, proteinG: 14, carbsG: 6, fatG: 19 },
  { name: "Shami Kebab", aliases: ["shami kabab"], kcal: 240, proteinG: 15, carbsG: 8, fatG: 16 },
  { name: "Bihari Kebab", aliases: ["bihari boti"], kcal: 235, proteinG: 16, carbsG: 3, fatG: 17 },

  // Vegetable dishes
  { name: "Aloo Palak", aliases: ["potato spinach", "saag aloo"], kcal: 110, proteinG: 3, carbsG: 12, fatG: 6 },
  { name: "Palak Paneer", aliases: ["saag paneer", "spinach cheese"], kcal: 180, proteinG: 8, carbsG: 7, fatG: 14 },
  { name: "Saag (Mustard Greens)", aliases: ["sarson ka saag"], kcal: 110, proteinG: 4, carbsG: 9, fatG: 6 },
  { name: "Bhindi Masala", aliases: ["okra curry", "ladyfinger"], kcal: 110, proteinG: 3, carbsG: 11, fatG: 6 },
  { name: "Baingan Bharta", aliases: ["eggplant curry", "brinjal"], kcal: 100, proteinG: 2.5, carbsG: 10, fatG: 6 },
  { name: "Aloo Matar", aliases: ["potato peas curry"], kcal: 115, proteinG: 3.5, carbsG: 16, fatG: 4 },
  { name: "Mixed Vegetable Curry", aliases: ["sabzi", "mix sabzi"], kcal: 110, proteinG: 3, carbsG: 12, fatG: 6 },
  { name: "Paneer", aliases: ["cottage cheese (paneer)"], kcal: 265, proteinG: 18, carbsG: 1.2, fatG: 21 },

  // Breads
  { name: "Roti (Chapati)", aliases: ["chapati", "phulka", "tandoori roti", "wheat roti"], kcal: 265, proteinG: 9, carbsG: 50, fatG: 4, servingSizeG: 40, servingLabel: "1 roti" },
  { name: "Naan", aliases: ["nan", "tandoori naan"], kcal: 290, proteinG: 9, carbsG: 50, fatG: 6, servingSizeG: 90, servingLabel: "1 naan" },
  { name: "Paratha (Plain)", aliases: ["parantha", "paratha"], kcal: 330, proteinG: 7, carbsG: 40, fatG: 16, servingSizeG: 60, servingLabel: "1 paratha" },
  { name: "Aloo Paratha", aliases: ["potato paratha", "aloo parantha"], kcal: 280, proteinG: 6, carbsG: 38, fatG: 12, servingSizeG: 100, servingLabel: "1 paratha" },
  { name: "Puri", aliases: ["poori", "fried bread"], kcal: 360, proteinG: 7, carbsG: 42, fatG: 18, servingSizeG: 30, servingLabel: "1 puri" },

  // Snacks & street food
  { name: "Samosa", aliases: ["samoosa"], kcal: 260, proteinG: 5, carbsG: 30, fatG: 13, servingSizeG: 50, servingLabel: "1 samosa" },
  { name: "Pakora", aliases: ["pakoda", "bhajia", "fritter"], kcal: 280, proteinG: 6, carbsG: 25, fatG: 17 },
  { name: "Chana Chaat", aliases: ["chickpea chaat", "chaat"], kcal: 140, proteinG: 6, carbsG: 20, fatG: 4 },
  { name: "Dahi Bhalla", aliases: ["dahi vada", "dahi bhalle"], kcal: 150, proteinG: 5, carbsG: 18, fatG: 6 },
  { name: "Fruit Chaat", aliases: ["fruit salad"], kcal: 70, proteinG: 1, carbsG: 17, fatG: 0.3 },
  { name: "Paratha Roll", aliases: ["chicken roll", "wrap"], kcal: 230, proteinG: 11, carbsG: 24, fatG: 10 },
  { name: "Bun Kebab", aliases: ["bun kabab"], kcal: 250, proteinG: 9, carbsG: 28, fatG: 11 },
  { name: "Shawarma", aliases: ["shwarma", "shawerma"], kcal: 215, proteinG: 12, carbsG: 20, fatG: 10 },

  // Dairy & drinks
  { name: "Yogurt (Dahi)", aliases: ["dahi", "curd", "yoghurt"], kcal: 60, proteinG: 3.5, carbsG: 5, fatG: 3.3 },
  { name: "Raita", aliases: ["yogurt sauce"], kcal: 60, proteinG: 3, carbsG: 5, fatG: 3 },
  { name: "Sweet Lassi", aliases: ["lassi", "meethi lassi"], kcal: 90, proteinG: 2.6, carbsG: 14, fatG: 2.5, servingSizeG: 250, servingLabel: "1 glass" },
  { name: "Chai (Milk Tea)", aliases: ["tea", "doodh patti", "garam chai"], kcal: 50, proteinG: 1.5, carbsG: 8, fatG: 1.5, servingSizeG: 240, servingLabel: "1 cup" },

  // Sweets
  { name: "Kheer", aliases: ["rice pudding", "firni"], kcal: 145, proteinG: 4, carbsG: 22, fatG: 5 },
  { name: "Gajar Halwa", aliases: ["carrot halwa", "gajrela"], kcal: 250, proteinG: 4, carbsG: 32, fatG: 12 },
  { name: "Sooji Halwa", aliases: ["semolina halwa", "halwa"], kcal: 350, proteinG: 4, carbsG: 45, fatG: 17 },
  { name: "Gulab Jamun", aliases: ["gulab jaman"], kcal: 290, proteinG: 4, carbsG: 45, fatG: 11, servingSizeG: 40, servingLabel: "1 piece" },
  { name: "Jalebi", aliases: ["jalaibi"], kcal: 340, proteinG: 2, carbsG: 55, fatG: 13 },
  { name: "Barfi", aliases: ["burfi"], kcal: 380, proteinG: 7, carbsG: 45, fatG: 19 },
  { name: "Ras Malai", aliases: ["rasmalai"], kcal: 230, proteinG: 7, carbsG: 28, fatG: 10 },
];

// --- Common reference whole foods -----------------------------------------
const REFERENCE: LocalFood[] = [
  // Fruit
  { name: "Apple", aliases: ["seb"], kcal: 52, proteinG: 0.3, carbsG: 14, fatG: 0.2, servingSizeG: 182, servingLabel: "1 medium" },
  { name: "Banana", aliases: ["kela"], kcal: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3, servingSizeG: 118, servingLabel: "1 medium" },
  { name: "Orange", aliases: ["malta", "santra"], kcal: 47, proteinG: 0.9, carbsG: 12, fatG: 0.1, servingSizeG: 130, servingLabel: "1 medium" },
  { name: "Mango", aliases: ["aam"], kcal: 60, proteinG: 0.8, carbsG: 15, fatG: 0.4 },
  { name: "Grapes", aliases: ["angoor"], kcal: 69, proteinG: 0.7, carbsG: 18, fatG: 0.2 },
  { name: "Watermelon", aliases: ["tarbooz"], kcal: 30, proteinG: 0.6, carbsG: 8, fatG: 0.2 },
  { name: "Guava", aliases: ["amrood"], kcal: 68, proteinG: 2.6, carbsG: 14, fatG: 1 },
  { name: "Pomegranate", aliases: ["anar"], kcal: 83, proteinG: 1.7, carbsG: 19, fatG: 1.2 },
  { name: "Dates", aliases: ["khajoor", "khajur"], kcal: 277, proteinG: 1.8, carbsG: 75, fatG: 0.2 },

  // Protein
  { name: "Egg (Boiled)", aliases: ["anda", "boiled egg"], kcal: 155, proteinG: 13, carbsG: 1.1, fatG: 11, servingSizeG: 50, servingLabel: "1 egg" },
  { name: "Chicken Breast (Cooked)", aliases: ["murghi", "grilled chicken"], kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
  { name: "Chicken Thigh (Cooked)", aliases: ["chicken leg"], kcal: 209, proteinG: 26, carbsG: 0, fatG: 11 },
  { name: "Beef (Cooked)", aliases: ["gosht", "beef meat"], kcal: 250, proteinG: 26, carbsG: 0, fatG: 15 },
  { name: "Mutton / Goat (Cooked)", aliases: ["mutton", "goat meat", "bakra"], kcal: 234, proteinG: 27, carbsG: 0, fatG: 13 },
  { name: "Fish (Cooked)", aliases: ["machli", "machhli"], kcal: 150, proteinG: 22, carbsG: 0, fatG: 6 },

  // Staples & dairy
  { name: "Whole Milk", aliases: ["doodh", "milk"], kcal: 61, proteinG: 3.2, carbsG: 4.8, fatG: 3.3, servingSizeG: 244, servingLabel: "1 cup" },
  { name: "Brown Rice (Cooked)", aliases: ["brown chawal"], kcal: 123, proteinG: 2.7, carbsG: 26, fatG: 1 },
  { name: "White Bread", aliases: ["bread", "double roti"], kcal: 265, proteinG: 9, carbsG: 49, fatG: 3.2, servingSizeG: 28, servingLabel: "1 slice" },
  { name: "Whole Wheat Bread", aliases: ["brown bread", "wheat bread"], kcal: 247, proteinG: 13, carbsG: 41, fatG: 3.4, servingSizeG: 28, servingLabel: "1 slice" },
  { name: "Potato (Boiled)", aliases: ["aloo", "alu"], kcal: 87, proteinG: 1.9, carbsG: 20, fatG: 0.1 },
  { name: "Sweet Potato (Boiled)", aliases: ["shakarkandi"], kcal: 86, proteinG: 1.6, carbsG: 20, fatG: 0.1 },
  { name: "Lentils (Cooked)", aliases: ["masoor", "lentil"], kcal: 116, proteinG: 9, carbsG: 20, fatG: 0.4 },
  { name: "Chickpeas (Cooked)", aliases: ["chana", "channa", "garbanzo"], kcal: 164, proteinG: 9, carbsG: 27, fatG: 2.6 },
  { name: "Kidney Beans (Cooked)", aliases: ["rajma beans", "red beans"], kcal: 127, proteinG: 9, carbsG: 23, fatG: 0.5 },

  // Nuts, fats & sweeteners
  { name: "Almonds", aliases: ["badam"], kcal: 579, proteinG: 21, carbsG: 22, fatG: 50 },
  { name: "Peanuts", aliases: ["moongphali", "groundnut"], kcal: 567, proteinG: 26, carbsG: 16, fatG: 49 },
  { name: "Walnuts", aliases: ["akhrot"], kcal: 654, proteinG: 15, carbsG: 14, fatG: 65 },
  { name: "Cashews", aliases: ["kaju"], kcal: 553, proteinG: 18, carbsG: 30, fatG: 44 },
  { name: "Butter", aliases: ["makhan"], kcal: 717, proteinG: 0.9, carbsG: 0.1, fatG: 81 },
  { name: "Ghee", aliases: ["clarified butter", "desi ghee"], kcal: 899, proteinG: 0, carbsG: 0, fatG: 99.8 },
  { name: "Sugar", aliases: ["cheeni", "shakar"], kcal: 387, proteinG: 0, carbsG: 100, fatG: 0 },
  { name: "Honey", aliases: ["shehad"], kcal: 304, proteinG: 0.3, carbsG: 82, fatG: 0 },

  // Vegetables
  { name: "Tomato", aliases: ["tamatar"], kcal: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2 },
  { name: "Onion", aliases: ["pyaz", "piyaz"], kcal: 40, proteinG: 1.1, carbsG: 9, fatG: 0.1 },
  { name: "Cucumber", aliases: ["kheera"], kcal: 15, proteinG: 0.7, carbsG: 3.6, fatG: 0.1 },
  { name: "Carrot", aliases: ["gajar"], kcal: 41, proteinG: 0.9, carbsG: 10, fatG: 0.2 },
  { name: "Spinach", aliases: ["palak"], kcal: 23, proteinG: 2.9, carbsG: 3.6, fatG: 0.4 },
];

const ALL_LOCAL_FOODS: LocalFood[] = [...SOUTH_ASIAN, ...REFERENCE];

// Pre-build a lowercase haystack (name + aliases) per row so search is a
// cheap substring scan, plus the name's words for boundary scoring. The
// list is small (~110 rows) — no index needed.
const INDEXED = ALL_LOCAL_FOODS.map((f, i) => {
  const name = f.name.toLowerCase();
  return {
    food: f,
    index: i,
    name,
    words: name.split(/\s+/),
    haystack: [f.name, ...(f.aliases ?? [])].join(" ").toLowerCase(),
  };
});

/**
 * AND-match every query token against the row's name+aliases. Ranks
 * whole-word / name-start matches first, then by name length (shorter =
 * more canonical), mirroring the USDA re-rank's bias toward plain entries.
 */
export function searchLocalFoods(query: string, limit = 12): UsdaFood[] {
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return [];

  const scored = INDEXED.filter((row) =>
    tokens.every((t) => row.haystack.includes(t))
  ).map((row) => {
    let score = 0;
    if (row.name === q) score += 100;
    else if (row.name.startsWith(q)) score += 60;
    // A token that starts a word in the name reads as a stronger match
    // than a mid-word substring ("dal" in "Daal" beats "dal" in "Jandal").
    for (const t of tokens) {
      if (row.words.some((w) => w.startsWith(t))) score += 8;
    }
    score -= Math.min(row.name.length / 10, 6);
    return { row, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }) => toUsdaFood(row.food, row.index));
}

function toUsdaFood(f: LocalFood, index: number): UsdaFood {
  return {
    fdcId: LOCAL_FOOD_FLOOR - index,
    name: f.name,
    brand: null,
    dataType: "Reference",
    per100g: {
      kcal: f.kcal,
      proteinG: f.proteinG,
      carbsG: f.carbsG,
      fatG: f.fatG,
    },
    servingSizeG: f.servingSizeG ?? null,
    servingLabel: f.servingLabel ?? null,
  };
}
