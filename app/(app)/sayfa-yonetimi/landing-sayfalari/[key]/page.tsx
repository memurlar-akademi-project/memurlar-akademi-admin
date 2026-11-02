import { MarketingPagesWorkspace } from "@/components/admin/marketing-pages/MarketingPagesWorkspace";
export default async function Page({ params }: { params: Promise<{ key: string }> }) { return <MarketingPagesWorkspace pageKey={(await params).key} />; }
