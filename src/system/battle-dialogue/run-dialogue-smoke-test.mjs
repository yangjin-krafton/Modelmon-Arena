import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DIALOGUE_CATEGORY_FILES, createBattleDialogueEngine } from "./index.js";
import { parseCsv } from "./csv.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../data");

async function main() {
  const library = await loadLibraryFromDisk();
  const engine = createBattleDialogueEngine({ library });
  const scenarios = createScenarios();

  printLibrarySummary(library);
  console.log("");
  console.log("=== Dialogue Smoke Test ===");

  for (const scenario of scenarios) {
    engine.reset();
    console.log("");
    console.log(`# ${scenario.name}`);

    for (const turnContext of scenario.turns) {
      const result = engine.generateTurn(turnContext, { debug: true });
      printTurnResult(result);
    }
  }
}

async function loadLibraryFromDisk() {
  const entries = await Promise.all(
    Object.entries(DIALOGUE_CATEGORY_FILES).map(async ([category, fileName]) => {
      const filePath = path.join(dataDir, fileName);
      const text = await readFile(filePath, "utf8");
      return [category, parseCsv(text)];
    })
  );

  return Object.fromEntries(entries);
}

function printLibrarySummary(library) {
  console.log("=== Dialogue Library Summary ===");

  for (const category of Object.keys(DIALOGUE_CATEGORY_FILES)) {
    const rows = library[category] || [];
    console.log(`${category}: ${rows.length} rows`);
  }

  const sceneCategories = ["sceneIntro", "sceneAction", "sceneResult", "sceneAfter"];
  console.log("");
  console.log("=== Scene Coverage Snapshot ===");

  for (const category of sceneCategories) {
    const rows = library[category] || [];
    const families = collectRuleValues(rows, "skill_family");
    const lengths = collectRuleValues(rows, "length_band");
    const usage = collectRuleValues(rows, "usage_bucket");
    console.log(
      `${category}: skill_family=${families.join("/") || "-"} | length_band=${lengths.join("/") || "-"} | usage_bucket=${usage.join("/") || "-"}`
    );
  }
}

function collectRuleValues(rows, fieldName) {
  return [...new Set(
    rows
      .flatMap((row) => String(row[fieldName] || "").split("|"))
      .map((value) => value.trim())
      .filter((value) => value && value !== "*")
  )].sort();
}

function printTurnResult(result) {
  const meta = result.debug.context;
  console.log(
    `turn ${result.context.turn} | phase=${meta.phase} importance=${meta.importance} role=${meta.commentaryRole} family=${meta.skillFamily} length=${meta.lengthBand} usage=${meta.usageBucket} damage=${meta.damageBand} hp=${meta.hpBand}`
  );
  console.log(`system  [${result.debug.selected.system.rowId || "-"}]: ${result.system}`);
  console.log(`explain [${result.debug.selected.explain.rowId || "-"}]: ${result.explain}`);
  console.log(`quote   [${result.debug.selected.quote.rowId || "-"}]: ${result.quote}`);

  result.debug.selected.story.forEach((entry, index) => {
    const source = entry.sourceEntries?.length
      ? entry.sourceEntries
          .map((item) =>
            item.usedFallback
              ? `${item.requestedCategory}->${item.fallbackCategory}:${item.rowId || "-"}`
              : `${item.category}:${item.rowId || "-"}`
          )
          .join(", ")
      : entry.rowId || "-";

    console.log(`story ${index + 1} [${source}]: ${result.storyParagraphs[index]}`);
  });
}

function createScenarios() {
  return [
    {
      name: "Opening Strike",
      turns: [
        createTurn({
          turn: 1,
          attackerName: "모델몬 A",
          defenderName: "모델몬 B",
          skillName: "라이트 펀치",
          skillPattern: "단일 공격",
          damage: 8,
          attackerHp: 100,
          attackerMaxHp: 100,
          defenderHp: 92,
          defenderMaxHp: 100,
          statusName: "없음",
          momentum: "even"
        })
      ]
    },
    {
      name: "Repeat Multi-Hit",
      turns: [
        createTurn({
          turn: 3,
          attackerName: "모델몬 A",
          defenderName: "모델몬 B",
          skillName: "연쇄 비트",
          skillPattern: "연타",
          damage: 10,
          attackerHp: 82,
          attackerMaxHp: 100,
          defenderHp: 68,
          defenderMaxHp: 100,
          statusName: "없음",
          momentum: "left"
        }),
        createTurn({
          turn: 4,
          attackerName: "모델몬 A",
          defenderName: "모델몬 B",
          skillName: "연쇄 비트",
          skillPattern: "연타",
          damage: 13,
          attackerHp: 82,
          attackerMaxHp: 100,
          defenderHp: 55,
          defenderMaxHp: 100,
          statusName: "없음",
          momentum: "left"
        }),
        createTurn({
          turn: 5,
          attackerName: "모델몬 A",
          defenderName: "모델몬 B",
          skillName: "연쇄 비트",
          skillPattern: "연타",
          damage: 14,
          attackerHp: 82,
          attackerMaxHp: 100,
          defenderHp: 41,
          defenderMaxHp: 100,
          statusName: "없음",
          momentum: "left"
        }),
        createTurn({
          turn: 6,
          attackerName: "모델몬 A",
          defenderName: "모델몬 B",
          skillName: "연쇄 비트",
          skillPattern: "연타",
          damage: 16,
          attackerHp: 82,
          attackerMaxHp: 100,
          defenderHp: 25,
          defenderMaxHp: 100,
          statusName: "없음",
          momentum: "left"
        })
      ]
    },
    {
      name: "Setup And Shield",
      turns: [
        createTurn({
          turn: 2,
          attackerName: "모델몬 C",
          defenderName: "모델몬 D",
          skillName: "코어 부스트",
          skillPattern: "버프",
          damage: 0,
          attackerHp: 96,
          attackerMaxHp: 100,
          defenderHp: 100,
          defenderMaxHp: 100,
          statusName: "없음",
          momentum: "even"
        }),
        createTurn({
          turn: 3,
          attackerName: "모델몬 C",
          defenderName: "모델몬 D",
          skillName: "실드 포즈",
          skillPattern: "보호막",
          damage: 0,
          attackerHp: 96,
          attackerMaxHp: 100,
          defenderHp: 100,
          defenderMaxHp: 100,
          statusName: "보호",
          momentum: "even"
        })
      ]
    },
    {
      name: "Control Swing",
      turns: [
        createTurn({
          turn: 7,
          attackerName: "모델몬 E",
          defenderName: "모델몬 F",
          skillName: "락 스텝",
          skillPattern: "행동 제어",
          damage: 9,
          attackerHp: 51,
          attackerMaxHp: 100,
          defenderHp: 31,
          defenderMaxHp: 100,
          statusName: "속박",
          momentum: "left"
        })
      ]
    },
    {
      name: "Recovery Turn",
      turns: [
        createTurn({
          turn: 5,
          attackerName: "모델몬 G",
          defenderName: "모델몬 H",
          skillName: "리페어 싱크",
          skillPattern: "회복",
          damage: 0,
          attackerHp: 38,
          attackerMaxHp: 100,
          defenderHp: 49,
          defenderMaxHp: 100,
          statusName: "회복",
          momentum: "right"
        })
      ]
    },
    {
      name: "Charge Finisher",
      turns: [
        createTurn({
          turn: 8,
          attackerName: "모델몬 I",
          defenderName: "모델몬 J",
          skillName: "오버 드라이브",
          skillPattern: "충전 공격",
          damage: 26,
          attackerHp: 27,
          attackerMaxHp: 100,
          defenderHp: 14,
          defenderMaxHp: 100,
          statusName: "지연",
          momentum: "right"
        })
      ]
    }
  ];
}

function createTurn(context) {
  return {
    attackerBrand: "OpenAI",
    defenderBrand: "Anthropic",
    ...context
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
