import { redirect } from "next/navigation";

export default async function EditSubjectTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`/testler/${id}/duzenle`);
}
