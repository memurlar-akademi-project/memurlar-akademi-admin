export type TopicContentForm = { summary: string; content_body: string; status: string };

// Structured content is authoritative; the API derives its plain-text search/download body.
export function topicContentPayload(form: TopicContentForm, blocks: Array<Record<string, unknown>> | null) {
  return {
    summary: form.summary || null,
    status: form.status,
    content_body: blocks === null ? form.content_body : "",
    content_blocks: blocks,
  };
}
