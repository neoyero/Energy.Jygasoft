import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { AdminNav } from "@/components/admin/admin-nav";
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

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-border p-4 md:block">
        <div className="mb-6">
          <p className="font-semibold tracking-tight">Jygasoft Energy</p>
          <p className="text-xs text-muted-foreground">{session.user.email}</p>
          <p className="text-xs text-muted-foreground">Rol: {session.user.rol}</p>
        </div>
        <AdminNav rol={session.user.rol} />
        <div className="mt-6 border-t border-border pt-4">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto p-6">{children}</main>
    </div>
  );
}
