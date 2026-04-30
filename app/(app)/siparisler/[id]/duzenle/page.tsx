import { notFound } from "next/navigation";
import { OrderFormPage } from "@/components/admin/orders/OrderFormPage";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);

  if (Number.isNaN(orderId)) {
    notFound();
  }

  return <OrderFormPage id={orderId} />;
}
