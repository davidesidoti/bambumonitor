import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";

export function Layout() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <Navbar />
      <main className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
