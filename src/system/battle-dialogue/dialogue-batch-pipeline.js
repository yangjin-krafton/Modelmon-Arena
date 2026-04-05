import { DIALOGUE_CATEGORY_FILES } from "./dialogue-library.js";

export const BATTLE_DIALOGUE_ROW_FIELDS = [
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

export const BATCH_JOB_STATUS = {
  queued: "queued",
  writing: "writing",
  reviewing: "reviewing",
  needsRevision: "needs_revision",
  approved: "approved",
  rejected: "rejected"
};

export const REVIEW_DECISION = {
  approve: "approve",
  revise: "revise"
};

const DEFAULT_MAX_ATTEMPTS = 3;

export function createDialogueBatchJob(input) {
  if (!input?.category) {
    throw new Error("Dialogue batch job requires category.");
  }

  if (!DIALOGUE_CATEGORY_FILES[input.category]) {
    throw new Error(`Unknown dialogue category: ${input.category}`);
  }

  return {
    jobId: input.jobId || `${input.category}-${Date.now()}`,
    category: input.category,
    requestedCount: Number(input.requestedCount || 1),
    constraints: input.constraints || {},
    reviewPolicy: input.reviewPolicy || {},
    seedRows: input.seedRows || [],
    metadata: input.metadata || {}
  };
}

export function createDialogueBatchWorkflow(config) {
  assertFunction(config?.writer, "writer");
  assertFunction(config?.reviewer, "reviewer");

  const writer = config.writer;
  const reviewer = config.reviewer;
  const maxAttempts = Number(config.maxAttempts || DEFAULT_MAX_ATTEMPTS);
  const now = config.now || (() => new Date().toISOString());
  const onEvent = config.onEvent || null;

  return {
    async runJob(input) {
      const job = createDialogueBatchJob(input);
      const state = createInitialJobState(job, now);

      while (state.attemptCount < maxAttempts && state.status !== BATCH_JOB_STATUS.approved) {
        state.status = BATCH_JOB_STATUS.writing;
        emitEvent(onEvent, "writing_started", state);

        const attemptNumber = state.attemptCount + 1;
        const writerOutput = await writer(buildWriterRequest(job, state, attemptNumber));
        const draftRows = normalizeDraftRows(writerOutput?.rows, job.category, attemptNumber);

        state.status = BATCH_JOB_STATUS.reviewing;
        emitEvent(onEvent, "review_started", state);

        const review = normalizeReviewResult(
          await reviewer(
            buildReviewerRequest(job, state, attemptNumber, draftRows)
          )
        );

        state.attemptCount = attemptNumber;
        state.lastDraftRows = draftRows;
        state.lastReview = review;
        state.history.push(
          createAttemptHistoryEntry({
            attemptNumber,
            draftRows,
            review,
            createdAt: now()
          })
        );

        if (review.decision === REVIEW_DECISION.approve) {
          state.status = BATCH_JOB_STATUS.approved;
          state.approvedRows = draftRows;
          emitEvent(onEvent, "job_approved", state);
          break;
        }

        state.status = BATCH_JOB_STATUS.needsRevision;
        emitEvent(onEvent, "job_revision_requested", state);
      }

      if (state.status !== BATCH_JOB_STATUS.approved) {
        state.status = BATCH_JOB_STATUS.rejected;
        emitEvent(onEvent, "job_rejected", state);
      }

      return finalizeJobState(state, now);
    },

    async runBatch(inputs) {
      const results = [];

      for (const input of inputs) {
        results.push(await this.runJob(input));
      }

      return {
        totalJobs: results.length,
        approvedJobs: results.filter((item) => item.status === BATCH_JOB_STATUS.approved).length,
        rejectedJobs: results.filter((item) => item.status === BATCH_JOB_STATUS.rejected).length,
        results
      };
    }
  };
}

function buildWriterRequest(job, state, attemptNumber) {
  return {
    job,
    attemptNumber,
    previousReview: state.lastReview,
    previousDraftRows: state.lastDraftRows,
    history: state.history
  };
}

function buildReviewerRequest(job, state, attemptNumber, draftRows) {
  return {
    job,
    attemptNumber,
    draftRows,
    previousReview: state.lastReview,
    history: state.history
  };
}

function createInitialJobState(job, now) {
  return {
    jobId: job.jobId,
    category: job.category,
    requestedCount: job.requestedCount,
    status: BATCH_JOB_STATUS.queued,
    createdAt: now(),
    completedAt: "",
    attemptCount: 0,
    approvedRows: [],
    lastDraftRows: [],
    lastReview: null,
    history: []
  };
}

function finalizeJobState(state, now) {
  return {
    ...state,
    completedAt: now()
  };
}

function createAttemptHistoryEntry({ attemptNumber, draftRows, review, createdAt }) {
  return {
    attemptNumber,
    createdAt,
    rowCount: draftRows.length,
    decision: review.decision,
    score: review.score,
    summary: review.summary,
    issues: review.issues,
    rewritePrompt: review.rewritePrompt,
    rows: draftRows
  };
}

function normalizeDraftRows(rows, category, attemptNumber) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error(`Writer returned no rows for ${category} attempt ${attemptNumber}.`);
  }

  return rows.map((row, index) => normalizeDraftRow(row, category, attemptNumber, index));
}

function normalizeDraftRow(row, category, attemptNumber, index) {
  const normalized = Object.fromEntries(
    BATTLE_DIALOGUE_ROW_FIELDS.map((fieldName) => [fieldName, ""])
  );

  for (const fieldName of BATTLE_DIALOGUE_ROW_FIELDS) {
    if (row?.[fieldName] !== undefined && row?.[fieldName] !== null) {
      normalized[fieldName] = String(row[fieldName]);
    }
  }

  normalized.id =
    normalized.id ||
    `${toKebabCase(category)}-draft-${attemptNumber}-${String(index + 1).padStart(3, "0")}`;
  normalized.weight = normalized.weight || "1";
  normalized.phase = normalized.phase || "*";
  normalized.importance = normalized.importance || "*";
  normalized.commentary_role = normalized.commentary_role || "*";
  normalized.skill_pattern = normalized.skill_pattern || "*";
  normalized.skill_family = normalized.skill_family || "*";
  normalized.status_name = normalized.status_name || "*";
  normalized.momentum = normalized.momentum || "*";
  normalized.length_band = normalized.length_band || "*";
  normalized.usage_bucket = normalized.usage_bucket || "*";
  normalized.damage_band = normalized.damage_band || "*";
  normalized.hp_band = normalized.hp_band || "*";
  normalized.tags = normalized.tags || "*";
  normalized.text = String(normalized.text || "").trim();

  if (!normalized.text) {
    throw new Error(`Draft row ${normalized.id} has empty text.`);
  }

  return normalized;
}

function normalizeReviewResult(review) {
  const decision = review?.decision === REVIEW_DECISION.approve ? REVIEW_DECISION.approve : REVIEW_DECISION.revise;

  return {
    decision,
    score: Number.isFinite(Number(review?.score)) ? Number(review.score) : null,
    summary: String(review?.summary || ""),
    issues: Array.isArray(review?.issues) ? review.issues.map((item) => String(item)) : [],
    rewritePrompt: String(review?.rewritePrompt || "")
  };
}

function emitEvent(onEvent, type, state) {
  if (!onEvent) {
    return;
  }

  onEvent({
    type,
    jobId: state.jobId,
    category: state.category,
    status: state.status,
    attemptCount: state.attemptCount
  });
}

function assertFunction(value, name) {
  if (typeof value !== "function") {
    throw new Error(`Dialogue batch workflow requires ${name} function.`);
  }
}

function toKebabCase(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}
