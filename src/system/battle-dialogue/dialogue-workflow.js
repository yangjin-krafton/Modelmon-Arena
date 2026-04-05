import { stringifyCsv } from "./csv.js";

export const DIALOGUE_CSV_HEADERS = [
  "id",
  "weight",
  "phase",
  "importance",
  "commentary_role",
  "skill_pattern",
  "skill_family",
  "status_name",
  "momentum",
  "length_band",
  "usage_bucket",
  "damage_band",
  "hp_band",
  "tags",
  "text"
];

export const DIALOGUE_REVIEW_DECISIONS = {
  APPROVE: "approve",
  REVISE: "revise",
  REJECT: "reject"
};

export function createDialogueWorkflow({
  writer,
  reviewer,
  maxRounds = 3,
  buildRowId = defaultBuildRowId
} = {}) {
  if (typeof writer !== "function") {
    throw new Error("Dialogue workflow requires a writer function.");
  }

  if (typeof reviewer !== "function") {
    throw new Error("Dialogue workflow requires a reviewer function.");
  }

  return {
    async runJob(job, options = {}) {
      return runDialogueJob(job, {
        writer,
        reviewer,
        maxRounds: options.maxRounds ?? maxRounds,
        buildRowId
      });
    },
    async runBatch(jobs, options = {}) {
      const results = [];

      for (const job of jobs || []) {
        results.push(
          await runDialogueJob(job, {
            writer,
            reviewer,
            maxRounds: options.maxRounds ?? maxRounds,
            buildRowId
          })
        );
      }

      return buildBatchResult(results);
    }
  };
}

async function runDialogueJob(job, { writer, reviewer, maxRounds, buildRowId }) {
  const normalizedJob = normalizeJob(job);
  const attempts = [];
  let approvedAttempt = null;

  for (let round = 1; round <= maxRounds; round += 1) {
    const previousAttempt = attempts[attempts.length - 1] || null;
    const draftInput = {
      job: normalizedJob,
      round,
      previousAttempt,
      attempts
    };
    const draft = normalizeDraft(await writer(draftInput), normalizedJob, round, buildRowId);
    const reviewInput = {
      job: normalizedJob,
      round,
      draft,
      previousAttempt,
      attempts
    };
    const review = normalizeReview(await reviewer(reviewInput));

    const attempt = {
      round,
      draft,
      review,
      approved: review.decision === DIALOGUE_REVIEW_DECISIONS.APPROVE
    };

    attempts.push(attempt);

    if (attempt.approved) {
      approvedAttempt = attempt;
      break;
    }

    if (review.decision === DIALOGUE_REVIEW_DECISIONS.REJECT) {
      break;
    }
  }

  return finalizeJobResult(normalizedJob, attempts, approvedAttempt);
}

function buildBatchResult(results) {
  const approved = results.filter((result) => result.status === "approved");
  const byCategory = groupApprovedRowsByCategory(approved);

  return {
    summary: {
      jobs: results.length,
      approved: approved.length,
      revisePending: results.filter((result) => result.status === "revise-pending").length,
      rejected: results.filter((result) => result.status === "rejected").length
    },
    results,
    approvedRowsByCategory: byCategory,
    approvedCsvByCategory: Object.fromEntries(
      Object.entries(byCategory).map(([category, rows]) => [category, stringifyCsv(rows, DIALOGUE_CSV_HEADERS)])
    )
  };
}

function finalizeJobResult(job, attempts, approvedAttempt) {
  const lastAttempt = attempts[attempts.length - 1] || null;
  const status = approvedAttempt
    ? "approved"
    : lastAttempt?.review?.decision === DIALOGUE_REVIEW_DECISIONS.REJECT
      ? "rejected"
      : "revise-pending";

  return {
    id: job.id,
    category: job.category,
    status,
    attempts,
    approvedDraft: approvedAttempt?.draft || null,
    approvedRow: approvedAttempt?.draft?.row || null,
    lastReview: lastAttempt?.review || null
  };
}

function normalizeJob(job) {
  if (!job || typeof job !== "object") {
    throw new Error("Dialogue workflow job must be an object.");
  }

  if (!job.id) {
    throw new Error("Dialogue workflow job requires an id.");
  }

  if (!job.category) {
    throw new Error("Dialogue workflow job requires a category.");
  }

  return {
    id: String(job.id),
    category: String(job.category),
    promptHints: Array.isArray(job.promptHints) ? job.promptHints.map(String) : [],
    requiredPlaceholders: Array.isArray(job.requiredPlaceholders) ? job.requiredPlaceholders.map(String) : [],
    rowDefaults: normalizeRowShape(job.rowDefaults || {}),
    metadata: job.metadata || {}
  };
}

function normalizeDraft(draft, job, round, buildRowId) {
  if (!draft || typeof draft !== "object") {
    throw new Error(`Dialogue writer must return an object for job ${job.id}.`);
  }

  const text = String(draft.text || "").trim();
  const row = normalizeRowShape({
    ...job.rowDefaults,
    ...(draft.row || {}),
    id: draft.row?.id || draft.id || buildRowId(job, round),
    text
  });

  return {
    id: String(draft.id || row.id),
    category: String(draft.category || job.category),
    text,
    notes: Array.isArray(draft.notes) ? draft.notes.map(String) : [],
    row
  };
}

function normalizeReview(review) {
  if (!review || typeof review !== "object") {
    throw new Error("Dialogue reviewer must return an object.");
  }

  const decision = String(review.decision || DIALOGUE_REVIEW_DECISIONS.REVISE);
  if (!Object.values(DIALOGUE_REVIEW_DECISIONS).includes(decision)) {
    throw new Error(`Unsupported dialogue review decision: ${decision}`);
  }

  return {
    decision,
    score: clampScore(review.score),
    reasonCodes: Array.isArray(review.reasonCodes) ? review.reasonCodes.map(String) : [],
    feedback: String(review.feedback || "").trim()
  };
}

function normalizeRowShape(row) {
  return DIALOGUE_CSV_HEADERS.reduce((result, header) => {
    result[header] = row[header] === undefined || row[header] === null ? "" : String(row[header]);
    return result;
  }, {});
}

function groupApprovedRowsByCategory(results) {
  return results.reduce((groups, result) => {
    const category = result.category;
    groups[category] = groups[category] || [];
    groups[category].push(result.approvedRow);
    return groups;
  }, {});
}

function clampScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) {
    return null;
  }

  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function defaultBuildRowId(job, round) {
  return `${job.id}-r${round}`;
}
