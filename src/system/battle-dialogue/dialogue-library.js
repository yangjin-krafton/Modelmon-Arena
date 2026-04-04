import { loadCsv } from "./csv.js";

export const DIALOGUE_CATEGORY_FILES = {
  system: "dialogue-system.csv",
  explain: "dialogue-explain.csv",
  quote: "dialogue-quote.csv",
  opening: "dialogue-opening.csv",
  build: "dialogue-build.csv",
  impact: "dialogue-impact.csv",
  reaction: "dialogue-reaction.csv",
  closing: "dialogue-closing.csv"
};

export async function loadBattleDialogueLibrary({
  baseUrl = "./data",
  fetchImpl = fetch
} = {}) {
  const entries = await Promise.all(
    Object.entries(DIALOGUE_CATEGORY_FILES).map(async ([category, fileName]) => {
      const rows = await loadCsv(`${baseUrl}/${fileName}`, fetchImpl);
      return [category, rows];
    })
  );

  return Object.fromEntries(entries);
}

export function createBattleDialogueLibraryFromRows(rowsByCategory) {
  return Object.fromEntries(
    Object.entries(DIALOGUE_CATEGORY_FILES).map(([category]) => [category, rowsByCategory[category] || []])
  );
}
