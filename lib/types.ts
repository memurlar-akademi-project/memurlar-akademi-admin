export type ApiEnvelope<T> = {
  success: boolean;
  message: string | null;
  data: T;
  meta: Record<string, unknown>;
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
    exam: {
      id: number;
      name: string;
    } | null;
  } | null;
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
  exam_date: string | null;
  is_active_for_signup: boolean;
  subject_ids: number[];
  ministry: {
    id: number;
    name: string;
    slug: string;
  } | null;
  subject_count: number;
  active_membership_count: number;
  readiness?: AdminReadiness;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminSubject = {
  id: number;
  name: string;
  slug: string;
  status: string;
  exam_ids: number[];
  exam_count: number;
  topic_count: number;
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
  content_version?: number | null;
  content_count?: number;
  has_podcast?: boolean;
  podcast_is_active?: boolean | null;
  podcast_audio_name?: string | null;
  readiness?: AdminReadiness;
  subject: {
    id: number;
    name: string;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminQuestion = {
  id: number;
  topic_id: number;
  question_type: string;
  difficulty: string;
  status: string;
  is_free?: boolean;
  free_preview_order?: number | null;
  is_past_exam_question?: boolean;
  question_text?: string;
  correct_answer_text?: string;
  explanation_text?: string;
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

export type AdminQuestionImportItem = {
  id: number;
  topic_id: number;
  topic_name_snapshot: string;
  question_type: "multiple_choice" | "true_false";
  difficulty: "easy" | "medium" | "hard";
  status: "active" | "passive" | "draft";
  question_text: string;
  correct_answer_text: string;
  explanation_text: string;
  options: Array<{
    label: string;
    option_text: string;
    is_correct: boolean;
  }>;
  review_status: "pending_review" | "rejected" | "approved" | "imported";
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
  transcript: string[];
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
  question_ids?: number[];
  exam: {
    id: number;
    name: string;
  } | null;
};

export type AdminTopicTest = {
  id: number;
  topic_id: number;
  title: string;
  slug?: string;
  status?: string;
  duration_min: number;
  instructions?: string | null;
  question_count: number;
  question_ids?: number[];
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

export type AdminSubjectTest = {
  id: number;
  subject_id: number;
  title: string;
  slug?: string;
  status?: string;
  duration_min: number;
  instructions?: string | null;
  question_count: number;
  question_ids?: number[];
  readiness?: AdminReadiness;
  subject: {
    id: number;
    name: string;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminDashboard = {
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

export type AdminContentImportTopic = {
  id: number;
  proposed_name: string;
  proposed_content_body: string | null;
  proposed_sort_order: number;
  review_status: "accepted" | "excluded";
  edited_name: string | null;
  edited_content_body: string | null;
  edited_sort_order: number | null;
  final_topic: {
    id: number;
    name: string;
    slug: string;
  } | null;
};

export type AdminContentImport = {
  id: number;
  source_type: "docx_upload" | "google_doc_link";
  source_title: string | null;
  source_reference: string | null;
  original_filename: string | null;
  processing_status: "queued" | "processing" | "review" | "approved" | "failed";
  review_status: "pending" | "review" | "approved";
  failure_message: string | null;
  processing_log: Array<{
    level: "info" | "warning" | "success" | "error";
    message: string;
    timestamp: string;
  }>;
  candidate_subject_name: string | null;
  selected_subject: {
    id: number;
    name: string;
    slug: string;
  } | null;
  final_subject: {
    id: number;
    name: string;
    slug: string;
  } | null;
  target_exam: {
    id: number;
    name: string;
  } | null;
  topic_count: number;
  accepted_topic_count: number;
  excluded_topic_count: number;
  processed_at?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  normalized_text?: string | null;
  topics?: AdminContentImportTopic[];
};
