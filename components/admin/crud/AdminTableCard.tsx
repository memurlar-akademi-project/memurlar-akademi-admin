import { ReactNode } from "react";

export function AdminTableCard({ children }: { children: ReactNode }) {
  return <section className="admin-card overflow-hidden">{children}</section>;
}
