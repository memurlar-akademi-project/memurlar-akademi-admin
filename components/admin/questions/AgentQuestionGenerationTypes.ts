import type { AdminQuestion } from "@/lib/types";

export type ModelProfile = {
  model?: string | null;
  generator?: string | null;
  qa?: string | null;
  editor_qa?: string;
  source_qa?: string;
  style_qa?: string;
  distractor_qa?: string;
  rewrite?: string | null;
  selector?: string | null;
};

export type AgentGenerationStartResponse = {
  job_id: string;
  status: string;
  job?: AgentGenerationJob | null;
};

export type AgentQuestionRun = {
  run_id: number;
  topic_id: number | null;
  topic_name: string | null;
  requested: number;
  generated: number;
  selected: number;
  rejected: number;
  rewritten: number;
  status: string;
  error_message?: string | null;
  decisions?: Array<{
    agent_name: string;
    decision: string;
    count: number;
  }>;
};

export type AgentJobStatus = {
  job_id: string;
  status: string;
  source_law_title?: string | null;
  topic_count?: number | null;
  question_count?: number | null;
  error_message?: string | null;
  question_runs?: AgentQuestionRun[];
  ai_stats?: {
    total_calls: number;
    total_input_tokens: number;
    total_output_tokens: number;
    avg_latency_ms: number;
    estimated_cost_usd: number;
  };
  ai_logs?: Array<{
    id: number;
    step: string | null;
    model: string;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
    success: boolean;
    error?: string | null;
    estimated_cost_usd: number;
    created_at?: string | null;
  }>;
};

export type AgentGenerationJob = {
  id: number;
  job_id: string;
  subject_id: number | null;
  subject_code?: string | null;
  subject_name?: string | null;
  source_law_name?: string | null;
  q_version?: number | null;
  requested_topic_count: number;
  requested_question_count: number;
  generated_question_count: number;
  duplicate_question_count: number;
  status: string;
  model_profile?: ModelProfile | null;
  topics?: Array<{
    topic_id: number;
    topic_name: string;
    requested_count: number;
  }>;
  topic_results?: AgentQuestionRun[];
  question_ids?: number[];
  error_message?: string | null;
  callback_received_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AgentJobListResponse = {
  jobs: AgentGenerationJob[];
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

export type AgentJobDetailResponse = {
  job: AgentGenerationJob;
  questions: AdminQuestion[];
};

export const runningStatuses = new Set(["queued", "generating_questions", "parsing", "chunking", "generating_topics"]);
export const cancelableStatuses = new Set(["queued", "running", "generating_questions", "parsing", "chunking", "generating_topics"]);

export function statusLabel(status: string) {
  if (status === "queued") {
    return "Kuyrukta";
  }

  if (status === "generating_questions") {
    return "Üretiliyor";
  }

  if (status === "completed") {
    return "Tamamlandı";
  }

  if (status === "partial") {
    return "Kısmi tamamlandı";
  }

  if (status === "failed") {
    return "Hatalı";
  }

  if (status === "cancelled") {
    return "İptal edildi";
  }

  return status;
}

export function statusTone(status: string) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status === "cancelled") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  if (status === "partial") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

export function formatMoney(value?: number) {
  if (typeof value !== "number") {
    return "$0.0000";
  }

  return `$${value.toFixed(4)}`;
}

export function modelNameFromProfile(profile?: ModelProfile | null) {
  const model = profile?.model || profile?.generator || profile?.qa || profile?.rewrite || profile?.selector;

  return model?.trim() || "-";
}

export function formatTokenCount(value?: number | null) {
  if (typeof value !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("tr-TR").format(value);
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
