import type { AdminPodcastEpisode } from "@/lib/types";

export function podcastTranscriptToText(transcript: AdminPodcastEpisode["transcript"] | null | undefined) {
  return (transcript ?? [])
    .map((line) => (typeof line === "string" ? line : line.text))
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}
