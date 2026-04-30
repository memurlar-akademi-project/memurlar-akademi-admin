"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { login, isBootstrapping, session } = useAdminAuth();
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("Test1234");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const disabled = useMemo(
    () => submitting || isBootstrapping || !email.trim() || !password.trim(),
    [email, isBootstrapping, password, submitting],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login({ email, password, device_name: "admin-web" });
      router.replace("/dashboard");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Giriş sırasında beklenmeyen bir hata oluştu.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!isBootstrapping && session) {
      router.replace("/dashboard");
    }
  }, [isBootstrapping, router, session]);

  return (
    <main className="min-h-screen px-5 py-8 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[32px] border border-white/60 bg-white/70 shadow-[0_30px_100px_rgba(15,23,42,0.08)] backdrop-blur lg:grid-cols-[1.15fr_0.85fr]">
        <section className="hidden flex-col justify-between bg-[linear-gradient(160deg,#0f1c33_0%,#17335e_52%,#2752a2_100%)] p-10 text-white lg:flex">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold">
              <span className="material-symbols-outlined text-[18px]">shield_person</span>
              Sistem Yönetimi
            </div>
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.28em] text-white/60">
                Memurlar Akademi Admin
              </p>
              <h1 className="max-w-lg text-5xl font-extrabold leading-[1.05]">
                İçerik, katalog ve sınav akışını tek yerden yönet.
              </h1>
              <p className="max-w-md text-base leading-7 text-white/72">
                Dersleri, konuları, soruları ve paketleri aynı operasyon yüzeyinden
                düzenleyen sade bir çalışma alanı.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              ["Katalog", "Bakanlık, sınav, ders ve konu ilişkileri"],
              ["İçerik", "Konu anlatımı, podcast ve hap bilgi yönetimi"],
              ["Ölçek", "Purpose-built servislerle hızlı admin akışı"],
              ["Kontrol", "Tek rol, net izin sınırı, temiz operasyon yüzeyi"],
            ].map(([title, copy]) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/8 p-4"
              >
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-2 text-sm leading-6 text-white/68">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center bg-[linear-gradient(180deg,#ffffff_0%,#f6f8fb_100%)] p-6 lg:p-10">
          <div className="w-full max-w-md space-y-8">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-admin-muted)]">
                Giriş
              </p>
              <div>
                <h2 className="text-3xl font-extrabold text-[var(--color-admin-ink)]">
                  Admin oturumu aç
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-admin-muted)]">
                  Sistem yöneticisi hesabınla giriş yap. Bu panel kullanıcı
                  uygulamasından ayrıdır.
                </p>
              </div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-admin-ink)]">
                  E-posta
                </span>
                <input
                  className="admin-input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@test.com"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-admin-ink)]">
                  Şifre
                </span>
                <input
                  className="admin-input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Test1234"
                />
              </label>

              {error ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                  {error}
                </div>
              ) : null}

              <button
                className="admin-button admin-button-primary w-full"
                disabled={disabled}
                type="submit"
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                {submitting ? "Giriş yapılıyor" : "Admin Girişi"}
              </button>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-[var(--color-admin-muted)]">
              Demo yönetici hesabı: <strong>admin@test.com</strong>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
