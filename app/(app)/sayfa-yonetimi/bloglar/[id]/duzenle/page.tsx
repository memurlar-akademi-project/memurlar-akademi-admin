import { BlogPostFormPage } from "@/components/admin/blog/BlogPostFormPage";

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <BlogPostFormPage mode="edit" postId={Number(id)} />;
}
