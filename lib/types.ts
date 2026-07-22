export type ApiEnvelope<T> = {
  success: boolean;
  message: string | null;
  data: T;
  meta: Record<string, unknown>;
};

export type AdminPaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number | null;
  to: number | null;
};

export type AdminSession = {
  token: string;
  tokenType: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
};

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: "active" | "passive";
  order_count: number;
  total_spent: number;
  last_activity_at: string | null;
  is_currently_active: boolean;
  membership: {
    type: string;
    status: string;
    starts_at?: string | null;
    ends_at?: string | null;
    exam: {
      id: number;
      name: string;
    } | null;
  } | null;
  activity: {
    answered_question_count: number;
    correct_answer_count: number;
    accuracy_rate: number;
    practice_session_count: number;
    completed_mock_exam_count: number;
    in_progress_mock_exam_count: number;
    completed_topic_count: number;
    in_progress_topic_count: number;
    note_count: number;
    favorite_question_count: number;
  };
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminOrder = {
  id: number;
  order_no: string;
  status: "pending" | "completed" | "failed" | "cancelled" | "refunded";
  total_amount: number;
  payment_method: string | null;
  invoice_no: string | null;
  ordered_at: string | null;
  items_snapshot: unknown;
  plan: {
    id: number;
    name: string;
  } | null;
  exam: {
    id: number;
    name: string;
  } | null;
  user: {
    id: number;
    name: string;
    email: string;
    status: string;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminLoginRequest = {
  email: string;
  password: string;
  device_name?: string;
};

export type AdminReadiness = {
  can_activate: boolean;
  blocking_reasons: string[];
  warnings: string[];
};

export type AdminMinistry = {
  id: number;
  name: string;
  slug: string;
  status: string;
  exam_count: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminExam = {
  id: number;
  name: string;
  slug: string;
  status: string;
  year: number | null;
  price: number;
  original_price: number | null;
  discount_percentage: number | null;
  discount_is_active: boolean;
  has_discount: boolean;
  discount_label: string | null;
  discount_campaign_label: string | null;
  exam_date: string | null;
  total_question_count: number | null;
  duration_min: number | null;
  passing_score: number | null;
  is_active_for_signup: boolean;
  topic_ids: number[];
  sections: AdminExamSection[];
  ministry: {
    id: number;
    name: string;
    slug: string;
  } | null;
  topic_count: number;
  active_membership_count: number;
  readiness?: AdminReadiness;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminExamSection = {
  id: number;
  title: string;
  question_count: number;
  sort_order: number;
  subject_ids: number[];
  subjects: Array<{
    id: number;
    code: string | null;
    name: string;
  }>;
};

export type AdminSubject = {
  id: number;
  code: string | null;
  name: string;
  slug: string;
  status: string;
  exam_ids: number[];
  exam_count: number;
  topic_count: number;
  question_count?: number;
  approved_question_count?: number;
  rejected_question_count?: number;
  pending_approval_question_count?: number;
  revised_pending_approval_question_count?: number;
  readiness?: AdminReadiness;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminTopic = {
  id: number;
  subject_id: number;
  name: string;
  slug: string;
  status: string;
  sort_order: number;
  exam_ids?: number[];
  content_version?: number | null;
  content_count?: number;
  has_podcast?: boolean;
  podcast_is_active?: boolean | null;
  podcast_audio_name?: string | null;
  readiness?: AdminReadiness;
  subject: {
    id: number;
    code?: string | null;
    name: string;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminLawDurationCategory = {
  id: number;
  subject_id: number;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  sort_order: number;
  items_count: number;
  active_items_count: number;
  subject: {
    id: number;
    code?: string | null;
    name: string;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminLawDurationItem = {
  id: number;
  category_id: number;
  topic_id: number | null;
  item_type: "duration" | "rule";
  title: string;
  value: string;
  description: string | null;
  article_reference: string | null;
  source_excerpt: string | null;
  status: string;
  sort_order: number;
  category: {
    id: number;
    title: string;
    subject: {
      id: number;
      code?: string | null;
      name: string;
    } | null;
  } | null;
  topic: {
    id: number;
    name: string;
    subject_id: number;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminQuestion = {
  id: number;
  topic_id: number;
  question_type: string;
  q_version?: number | null;
  difficulty: string;
  status: string;
  question_bank_type?: "practice" | "mock_exam" | string;
  is_free?: boolean;
  free_preview_order?: number | null;
  is_past_exam_question?: boolean;
  question_text?: string;
  correct_answer_text?: string;
  explanation_text?: string;
  explanation_basis?: string | null;
  explanation_relevant_provision?: string | null;
  explanation_answer_link?: string | null;
  explanation?: {
    basis: string | null;
    relevant_provision: string | null;
    answer_link: string | null;
  } | null;
  review_flags?: string[];
  review_note?: string | null;
  approval_status?: "approved" | "rejected" | null;
  approval_revision_status?: "needs_revision" | "revised_pending_review" | string | null;
  approval_revised_at?: string | null;
  approval_revision_note?: string | null;
  quality_status?: "passed" | "failed" | "borderline" | "delete_recommended" | null;
  quality_score?: number | null;
  quality_flags?: string[];
  quality_note?: string | null;
  quality_model?: string | null;
  quality_checked_at?: string | null;
  published_at?: string | null;
  topic: {
    id: number;
    name: string;
    subject?: {
      id: number;
      name: string;
    } | null;
  } | null;
  options?: Array<{
    id?: number;
    label: string;
    option_text: string;
    is_correct: boolean;
    sort_order?: number;
  }>;
  readiness?: AdminReadiness;
};

export type AdminQuestionQualityCandidate = {
  id: number;
  topic_id: number;
  q_version?: number | null;
  question_text: string;
  correct_answer_text: string;
  explanation_text: string;
  explanation?: AdminQuestion["explanation"];
  difficulty: string;
  status: string;
  quality_status?: "passed" | "failed" | "borderline" | "delete_recommended" | null;
  quality_score?: number | null;
  quality_flags?: string[];
  quality_note?: string | null;
  quality_checked_at?: string | null;
  options: Array<{
    label: string;
    option_text: string;
    is_correct: boolean;
    sort_order?: number;
  }>;
  topic: AdminQuestion["topic"];
};

export type AdminQuestionQualityRunItem = {
  question_id: number;
  predicted_label?: string | null;
  solver_confidence?: number | null;
  quality_status: "passed" | "failed" | "borderline" | "delete_recommended";
  quality_score: number;
  quality_flags: string[];
  quality_note: string;
  question?: {
    id: number;
    status: string;
    q_version?: number | null;
    approval_status?: "approved" | "rejected" | null;
    question_text: string;
    correct_answer_text: string;
    explanation_text: string;
    options: Array<{
      label: string;
      option_text: string;
      is_correct: boolean;
      sort_order?: number;
    }>;
  } | null;
};

export type AdminQuestionQualityRunResult = {
  run: {
    id: number;
    topic_id: number;
    topic?: {
      id: number;
      name: string;
      subject?: {
        id: number;
        code?: string | null;
        name: string;
      } | null;
    } | null;
    model: string;
    status: "queued" | "running" | "completed" | "failed";
    requested_count: number;
    analyzed_count: number;
    passed_count: number;
    failed_count: number;
    borderline_count: number;
    failure_message?: string | null;
    created_at?: string | null;
  };
  good_question_ids: number[];
  bad_question_ids: number[];
  borderline_question_ids: number[];
  delete_recommended_question_ids: number[];
  items: AdminQuestionQualityRunItem[];
};

export type AdminQuestionQualityRunSummary = {
  id: number;
  topic_id: number;
  topic?: {
    id: number;
    name: string;
    subject?: {
      id: number;
      code?: string | null;
      name: string;
    } | null;
  } | null;
  model?: string | null;
  requested_count: number;
  analyzed_count: number;
  passed_count: number;
  failed_count: number;
  borderline_count: number;
  delete_recommended_count: number;
  status: "queued" | "running" | "completed" | "failed";
  failure_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminQuestionRewriteRevision = {
  id: number;
  question_text: string;
  correct_answer_text: string;
  explanation_text: string;
  explanation?: AdminQuestion["explanation"];
  explanation_basis?: string | null;
  explanation_relevant_provision?: string | null;
  explanation_answer_link?: string | null;
  changed_question_text: boolean;
  revision_note: string;
  quality_flags: string[];
  quality_note?: string | null;
  original: {
    question_text: string;
    correct_answer_text: string;
    explanation_text: string;
    explanation?: AdminQuestion["explanation"];
    options: Array<{
      label: string;
      option_text: string;
      is_correct: boolean;
    }>;
  };
  options: Array<{
    label: string;
    option_text: string;
    is_correct: boolean;
  }>;
};

export type AdminQuestionRewritePreviewResult = {
  model: string;
  revision_count: number;
  revisions: AdminQuestionRewriteRevision[];
};

export type AdminQuestionRewritePreviewJob = {
  id: number;
  question_ids: number[];
  model?: string | null;
  status: "queued" | "running" | "completed" | "failed";
  result?: AdminQuestionRewritePreviewResult | null;
  revision_count: number;
  failure_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminQuestionImportItem = {
  id: number;
  topic_id: number;
  topic_name_snapshot: string;
  question_type: "multiple_choice" | "true_false";
  q_version?: number | null;
  difficulty: "easy" | "medium" | "hard";
  status: "active" | "passive" | "draft";
  question_bank_type?: "practice" | "mock_exam" | string;
  question_text: string;
  correct_answer_text: string;
  explanation_text: string;
  explanation_basis?: string | null;
  explanation_relevant_provision?: string | null;
  explanation_answer_link?: string | null;
  explanation?: AdminQuestion["explanation"];
  options: Array<{
    label: string;
    option_text: string;
    is_correct: boolean;
  }>;
  review_status: "pending_review" | "rejected" | "approved" | "imported";
  review_note?: string | null;
  imported_at?: string | null;
  topic: {
    id: number;
    name: string;
    subject?: {
      id: number;
      name: string;
    } | null;
  } | null;
  final_question: {
    id: number;
    question_text: string;
    status: string;
  } | null;
};

export type AdminQuestionImport = {
  id: number;
  source_type: "json_upload" | "json_paste";
  status: "draft" | "review" | "completed";
  total_count: number;
  imported_count: number;
  rejected_count: number;
  pending_count: number;
  topic_count: number;
  raw_payload?: Record<string, unknown> | null;
  items?: AdminQuestionImportItem[];
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

export type AdminFlashcard = {
  id: number;
  topic_id?: number;
  front_text: string;
  back_text: string;
  status: string;
  sort_order?: number;
  is_free?: boolean;
  readiness?: AdminReadiness;
  topic: {
    id: number;
    name: string;
    subject?: {
      id: number;
      name: string;
    } | null;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminFlashcardImportItem = {
  id: number;
  topic_id: number;
  topic_name_snapshot: string;
  status: "active" | "passive" | "draft";
  front_text: string;
  back_text: string;
  sort_order?: number | null;
  is_free?: boolean;
  review_status: "pending_review" | "rejected" | "imported";
  review_note?: string | null;
  imported_at?: string | null;
  topic: {
    id: number;
    name: string;
    subject?: {
      id: number;
      name: string;
    } | null;
  } | null;
  final_flashcard: {
    id: number;
    front_text: string;
    status: string;
  } | null;
};

export type AdminFlashcardImport = {
  id: number;
  source_type: "json_upload" | "json_paste";
  status: "draft" | "review" | "completed";
  total_count: number;
  imported_count: number;
  rejected_count: number;
  pending_count: number;
  topic_count: number;
  raw_payload?: Record<string, unknown> | null;
  items?: AdminFlashcardImportItem[];
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

export type AdminPodcastLesson = {
  id: number;
  subject_id?: number | null;
  code: string;
  name: string;
  episode_count: number;
  sort_order?: number;
  is_active?: boolean;
  subject?: {
    id: number;
    name: string;
  } | null;
};

export type AdminPodcastEpisode = {
  id: number;
  podcast_lesson_id: number;
  topic_id: number | null;
  title: string;
  duration_seconds: number;
  transcript: Array<
    | string
    | {
        startSec: number;
        endSec?: number;
        speaker?: string;
        text: string;
      }
  >;
  script_text?: string | null;
  script_status?: "missing" | "draft" | "ready" | "sent" | "generated" | "failed" | string | null;
  script_source_hash?: string | null;
  script_character_count?: number;
  script_generation_meta?: Record<string, unknown> | null;
  script_generated_at?: string | null;
  tts_provider?: string | null;
  tts_voice_id?: string | null;
  tts_model_id?: string | null;
  audio_disk?: string | null;
  audio_path?: string | null;
  audio_original_filename?: string | null;
  audio_url?: string | null;
  sort_order: number;
  is_active: boolean;
  lesson: {
    id: number;
    name: string;
    code: string;
  } | null;
  topic: {
    id: number;
    name: string;
    subject?: {
      id: number;
      name: string;
    } | null;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminPodcastVoice = {
  voice_id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  labels?: Record<string, string>;
  preview_url?: string | null;
  is_owner?: boolean | null;
  is_legacy?: boolean | null;
};

export type AdminMockExam = {
  id: number;
  exam_id?: number;
  title: string;
  slug?: string;
  status?: string;
  question_count: number;
  duration_min: number;
  sort_order?: number;
  scheduled_at?: string | null;
  is_tr_general?: boolean;
  is_free?: boolean;
  question_ids?: number[];
  exam: {
    id: number;
    name: string;
  } | null;
};

export type AdminTest = {
  id: number;
  scope: "subject" | "topic";
  exam_id?: number | null;
  subject_id: number;
  topic_id: number | null;
  title: string;
  slug?: string;
  status?: string;
  duration_min: number;
  instructions?: string | null;
  is_auto_generated?: boolean;
  auto_generated_key?: string | null;
  generated_at?: string | null;
  question_count: number;
  question_ids?: number[];
  readiness?: AdminReadiness;
  exam: {
    id: number;
    name: string;
  } | null;
  subject: {
    id: number;
    name: string;
  } | null;
  topic: {
    id: number;
    name: string;
    subject?: {
      id: number;
      name: string;
    } | null;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminTestGenerationSummary = {
  exams_seen: number;
  subjects_seen: number;
  topics_seen: number;
  eligible_question_count: number;
  selected_question_count: number;
  planned_create_count: number;
  planned_update_count: number;
  planned_deactivate_count: number;
  skipped_count: number;
};

export type AdminTestGenerationPlan = {
  type: "subject" | "topic";
  auto_generated_key: string;
  exam_id?: number | null;
  exam_name?: string | null;
  subject_id: number;
  subject_name: string;
  topic_id: number | null;
  topic_name: string | null;
  title: string;
  duration_min: number;
  eligible_question_count: number;
  selected_question_count: number;
  action: "create" | "update" | "deactivate" | "skip";
  reason: string;
};

export type AdminTestGenerationResult = {
  summary: AdminTestGenerationSummary;
  plans: AdminTestGenerationPlan[];
};

export type AdminDashboard = {
  exam_overview: {
    id: number;
    name: string;
    slug: string;
    status: string;
    year: number | null;
    ministry_name: string | null;
    exam_date: string | null;
    days_until_exam: number | null;
    total_question_count: number;
    duration_min: number;
    passing_score: number | null;
    section_count: number;
    subject_count: number;
    topic_count: number;
    active_membership_count: number;
    active_mock_exam_count: number;
    draft_mock_exam_count: number;
  } | null;
  totals: {
    users: number;
    active_memberships: number;
    orders: number;
    subjects: number;
    topics: number;
    questions: number;
    tests: number;
    mock_exams: number;
  };
  today: {
    new_users: number;
    logged_in_users: number;
    questions_solved: number;
    orders: number;
    revenue: number;
  };
  engagement: {
    currently_active_users: number;
    active_users_today: number;
    active_users_last_7_days: number;
    accuracy_rate_today: number;
    accuracy_rate_last_7_days: number;
  };
  commerce: {
    orders_this_week: number;
    orders_total: number;
  };
  activity_last_7_days: Array<{
    date: string;
    label: string;
    registrations: number;
    questions_solved: number;
  }>;
  exam_performance: Array<{
    id: number;
    name: string;
    ministry_name: string | null;
    active_membership_count: number;
    paid_membership_count: number;
    price: number;
    estimated_revenue: number;
  }>;
  content_health: {
    active_topics: number;
    draft_topics: number;
    active_questions: number;
    draft_questions: number;
    active_tests: number;
    draft_tests: number;
    active_mock_exams: number;
    draft_mock_exams: number;
  };
  subject_coverage: Array<{
    id: number;
    name: string;
    topic_count: number;
    active_topic_count: number;
    question_count: number;
  }>;
  subject_engagement: {
    top_solved: Array<{
      id: number;
      name: string;
      answered_count: number;
      correct_count: number;
      accuracy_rate: number;
    }>;
    lowest_accuracy: Array<{
      id: number;
      name: string;
      answered_count: number;
      correct_count: number;
      accuracy_rate: number;
    }>;
  };
  recent_orders: Array<{
    id: number;
    order_no: string;
    status: string;
    total_amount: number;
    ordered_at: string | null;
    plan_name: string | null;
    user: {
      id: number | null;
      name: string | null;
      email: string | null;
    };
  }>;
  recent_users: Array<{
    id: number;
    name: string;
    email: string;
    created_at: string | null;
    membership_type: string | null;
    membership_status: string | null;
    exam_name: string | null;
  }>;
};

export type AdminSubscriptionPlan = {
  id: number;
  name: string;
  membership_type: string;
  price: number;
  order_count: number;
};
