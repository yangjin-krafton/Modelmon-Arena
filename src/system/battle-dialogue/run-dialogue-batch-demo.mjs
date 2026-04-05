import { createDialogueBatchWorkflow, REVIEW_DECISION } from "./dialogue-batch-pipeline.js";

const workflow = createDialogueBatchWorkflow({
  async writer({ job, attemptNumber, previousReview }) {
    const rewriteHint = previousReview?.rewritePrompt ? ` ${previousReview.rewritePrompt}` : "";

    return {
      rows: Array.from({ length: job.requestedCount }, (_, index) => ({
        id: `${job.category}-demo-${attemptNumber}-${index + 1}`,
        weight: "1",
        phase: job.constraints.phase || "*",
        importance: job.constraints.importance || "*",
        commentary_role: job.constraints.commentaryRole || "*",
        skill_pattern: job.constraints.skillPattern || "*",
        skill_family: job.constraints.skillFamily || "*",
        status_name: job.constraints.statusName || "*",
        momentum: job.constraints.momentum || "*",
        length_band: job.constraints.lengthBand || "*",
        usage_bucket: job.constraints.usageBucket || "*",
        damage_band: job.constraints.damageBand || "*",
        hp_band: job.constraints.hpBand || "*",
        tags: "*",
        text: `지금은 ${job.category} 데모 문장 ${index + 1}이에요.${rewriteHint}`.trim()
      }))
    };
  },

  async reviewer({ attemptNumber, draftRows }) {
    const hasShortText = draftRows.some((row) => row.text.length < 16);

    if (!hasShortText && attemptNumber >= 2) {
      return {
        decision: REVIEW_DECISION.approve,
        score: 92,
        summary: "길이와 톤이 기준선에 들어왔습니다.",
        issues: []
      };
    }

    return {
      decision: REVIEW_DECISION.revise,
      score: 68,
      summary: "문장 길이와 톤을 조금 더 안정적으로 맞춰야 합니다.",
      issues: ["짧은 반응과 설명형 문장을 더 분리하세요."],
      rewritePrompt: "짧은 문장과 중간 길이 문장을 섞고 말끝을 더 자연스럽게 정리하세요."
    };
  }
});

const result = await workflow.runJob({
  jobId: "scene-action-demo",
  category: "sceneAction",
  requestedCount: 2,
  constraints: {
    skillFamily: "multi-hit",
    lengthBand: "medium",
    usageBucket: "repeat",
    phase: "전",
    commentaryRole: "highlight"
  }
});

console.log(JSON.stringify(result, null, 2));
