import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDialogueWorkflow,
  DIALOGUE_REVIEW_DECISIONS
} from "./dialogue-workflow.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), args.input || path.join(__dirname, "examples", "batch-scenario.json"));
  const outputPath = path.resolve(process.cwd(), args.out || path.join(__dirname, "examples", "batch-result.json"));
  const rounds = Number(args.rounds || 3);
  const payload = JSON.parse(await readFile(inputPath, "utf8"));

  const workflow = createDialogueWorkflow({
    writer: createMockWriter(),
    reviewer: createMockReviewer(),
    maxRounds: rounds
  });

  const batch = await workflow.runBatch(payload.jobs || [], { maxRounds: rounds });
  const output = {
    input: path.relative(process.cwd(), inputPath),
    generatedAt: new Date().toISOString(),
    summary: batch.summary,
    results: batch.results,
    approvedCsvByCategory: batch.approvedCsvByCategory
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");

  console.log(`workflow input : ${inputPath}`);
  console.log(`workflow output: ${outputPath}`);
  console.log(`approved       : ${batch.summary.approved}/${batch.summary.jobs}`);

  for (const result of batch.results) {
    console.log(`${result.id} -> ${result.status}`);
  }
}

function createMockWriter() {
  return async function writer({ job, round, previousAttempt }) {
    const shortText = getShortDraft(job);
    const revisedText = getRevisedDraft(job, previousAttempt?.review?.reasonCodes || []);
    const text = round === 1 ? shortText : revisedText;

    return {
      id: `${job.id}-draft-${round}`,
      category: job.category,
      text,
      row: {
        ...job.rowDefaults,
        text
      },
      notes: round === 1 ? ["first-pass"] : ["revised-from-review"]
    };
  };
}

function createMockReviewer() {
  return async function reviewer({ job, draft, attempts }) {
    const reasons = [];

    if (isTooShortForBand(draft.text, draft.row.length_band)) {
      reasons.push("too_short");
    }

    if (job.requiredPlaceholders.some((token) => !draft.text.includes(token))) {
      reasons.push("placeholder_missing");
    }

    if (containsToneMismatch(draft.text)) {
      reasons.push("tone_mismatch");
    }

    if (attempts.some((attempt) => attempt.draft.text === draft.text)) {
      reasons.push("too_similar_recently");
    }

    if (!reasons.length) {
      return {
        decision: DIALOGUE_REVIEW_DECISIONS.APPROVE,
        score: 0.92,
        reasonCodes: [],
        feedback: "approved"
      };
    }

    return {
      decision: DIALOGUE_REVIEW_DECISIONS.REVISE,
      score: 0.45,
      reasonCodes: reasons,
      feedback: "expand length, keep tone, vary the line"
    };
  };
}

function getShortDraft(job) {
  const family = job.rowDefaults.skill_family || "utility";

  if (family === "multi-hit") {
    return `${job.requiredPlaceholders[0] || "{{attacker_name}}"} 또 간다.`;
  }

  if (family === "setup") {
    return "여기 정리해 둔다.";
  }

  if (family === "control") {
    return "지금 묶는다.";
  }

  return "지금 들어간다.";
}

function getRevisedDraft(job, reasonCodes) {
  const attacker = job.requiredPlaceholders.includes("{{attacker_name}}") ? "{{attacker_name}}" : "공격자";
  const defender = job.requiredPlaceholders.includes("{{defender_name}}") ? "{{defender_name}}" : "상대";
  const skill = job.requiredPlaceholders.includes("{{skill_name}}") ? "{{skill_name}}" : "기술";
  const family = job.rowDefaults.skill_family || "utility";

  if (family === "multi-hit") {
    return `${attacker} 쪽 리듬이 한번 붙으니까 ${skill} 박자가 생각보다 길게 이어져요. ${defender}은 첫 타를 막고도 바로 중심을 다시 못 세워서, 같은 기술을 또 봤는데도 체감 부담이 더 커지는 장면이에요.`;
  }

  if (family === "setup") {
    return `${attacker}은 지금 무리해서 세게 밀지 않아요. 대신 ${skill}로 먼저 판을 정리하면서 다음 교환에서 ${defender}이 같은 방식으로 들어오기 어렵게 만드는 쪽을 택해요. 조용해 보여도 흐름상 꽤 큰 준비 턴이에요.`;
  }

  if (family === "control") {
    return `${skill}는 한 번 세게 때리는 기술이라기보다 ${defender}의 타이밍을 비틀어 두는 쪽에 가까워요. 그래서 맞는 순간보다 그 직후가 더 답답하게 남고, ${attacker}은 그 빈 박자를 이용해서 다음 선택까지 같이 압박할 수 있게 돼요.`;
  }

  if (reasonCodes.includes("placeholder_missing")) {
    return `${attacker}이 ${skill}를 꺼내는 순간 ${defender} 쪽 계산이 바로 달라져요. 크게 화려하진 않아도 전장 해석을 바꿔 놓는 타입이라, 다음 교환에서 느껴지는 압박이 생각보다 길게 남아요.`;
  }

  return `${attacker}이 ${skill}를 밀어 넣은 뒤부터 전장 분위기가 조금 달라져요. ${defender}은 바로 다음 선택을 편하게 고르기 어려워지고, 이 한 번이 뒤쪽 흐름까지 같이 흔들 수 있는 장면으로 이어져요.`;
}

function isTooShortForBand(text, lengthBand) {
  const length = String(text || "").trim().length;
  if (lengthBand === "long") return length < 90;
  if (lengthBand === "medium") return length < 45;
  return length < 12;
}

function containsToneMismatch(text) {
  return /ㅋㅋ|헐|레전드|미쳤다/.test(String(text || ""));
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    args[key] = next && !next.startsWith("--") ? next : true;
    if (args[key] === next) {
      index += 1;
    }
  }

  return args;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
