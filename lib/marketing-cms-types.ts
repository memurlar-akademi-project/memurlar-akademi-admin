export type MarketingContent = {
  hero_title: string; hero_highlight: string; hero_description: string; hero_image: string;
  primary_cta_label: string; primary_cta_href: string; seo_title: string; seo_description: string;
  faqs: { question: string; answer: string }[]; sections: { heading: string; body: string }[];
};
export type ManagedMarketingPage = { key: string; name: string; path: string; template: string; live_exam_slug: string | null; content: MarketingContent };
