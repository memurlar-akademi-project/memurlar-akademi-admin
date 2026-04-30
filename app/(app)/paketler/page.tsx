"use client";

import { useAdminList } from "@/hooks/useAdminList";
import { AdminEntityPage } from "@/components/admin/AdminEntityPage";
import type { AdminSubscriptionPlan } from "@/lib/types";

export default function PlansPage() {
  const { items, loading, error, refresh } = useAdminList<AdminSubscriptionPlan>({
    endpoint: "/admin/subscription-plans",
    responseKey: "plans",
  });

  return (
    <AdminEntityPage<AdminSubscriptionPlan>
      title="Paketler"
      description="Üyelik paketleri ve fiyatlama yüzeyi."
      loading={loading}
      error={error}
      items={items}
      onRefresh={refresh}
      columns={[
        { key: "name", header: "Paket" },
        { key: "membership_type", header: "Tip" },
        {
          key: "price",
          header: "Fiyat",
          render: (item) => `${item.price} TL`,
        },
        {
          key: "order_count",
          header: "Sipariş",
          render: (item) => `${item.order_count}`,
        },
      ]}
    />
  );
}
