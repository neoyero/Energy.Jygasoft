import { redirect } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { SignOutButton } from "@/components/admin/sign-out-button";

export const metadata: Metadata = {
  title: "Panel",
  robots: { index: false, follow: false },
};

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/je-admin/login");

  const name = session.user.name ?? session.user.email ?? "Usuario";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-brand-surface">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-stone-200 bg-white md:flex">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-stone-100 px-5">
          <Image
            src="/logo.png"
            alt="Jygasoft Energy"
            width={140}
            height={36}
            priority
            className="h-8 w-auto object-contain"
          />
        </div>

        {/* Navegación (scrollable) */}
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <AdminNav rol={session.user.rol} />
        </div>

        {/* Usuario + salir */}
        <div className="border-t border-stone-100 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-green text-sm font-bold text-white">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-brand">{name}</p>
              <p className="truncate text-xs capitalize text-stone-500">
                {session.user.rol ?? "—"}
              </p>
            </div>
          </div>
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Navegación móvil (topbar + drawer); oculta en >= md */}
        <AdminMobileNav rol={session.user.rol} name={name} initial={initial} />
        <main className="flex-1 overflow-x-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
