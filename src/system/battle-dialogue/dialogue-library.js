import { loadCsv } from "./csv.js";

export const DIALOGUE_CATEGORY_FILES = {
  system: "dialogue-system.csv",
  explain: "dialogue-explain.csv",
  quote: "dialogue-quote.csv",
  opening: "dialogue-opening.csv",
  build: "dialogue-build.csv",
  impact: "dialogue-impact.csv",
  reaction: "dialogue-reaction.csv",
  closing: "dialogue-closing.csv",
  sceneIntro: "dialogue-scene-intro.csv",
  sceneAction: "dialogue-scene-action.csv",
  sceneResult: "dialogue-scene-result.csv",
  sceneAfter: "dialogue-scene-after.csv"
};

export async function loadBattleDialogueLibrary({
  baseUrl = "./data",
  fetchImpl = fetch,
  optionalCategories = [
    "opening",
    "build",
    "impact",
    "reaction",
    "closing",
    "sceneIntro",
    "sceneAction",
    "sceneResult",
    "sceneAfter"
  ]
} = {}) {
  const optionalSet = new Set(optionalCategories);
  const entries = await Promise.all(
    Object.entries(DIALOGUE_CATEGORY_FILES).map(async ([category, fileName]) => {
      try {
        const rows = await loadCsv(`${baseUrl}/${fileName}`, fetchImpl);
        return [category, rows];
      } catch (error) {
        if (optionalSet.has(category)) {
          return [category, []];
        }
        throw error;
      }
    })
  );

  return Object.fromEntries(entries);
}
