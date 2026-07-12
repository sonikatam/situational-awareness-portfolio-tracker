import Link from "next/link";
import { Activity } from "lucide-react";

const nav = [["/", "Dashboard"], ["/portfolio", "Portfolio"], ["/filings", "Filings"], ["/changes", "Changes"]];

export function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-zinc-950">
          <span className="grid size-9 place-items-center bg-zinc-950 text-white"><Activity className="size-5" aria-hidden="true" /></span>
          <span><strong className="block text-sm">Situational Awareness</strong><span className="block text-xs text-zinc-500">Public filings tracker</span></span>
        </Link>
        <nav aria-label="Primary navigation" className="flex gap-1 overflow-x-auto">
          {nav.map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950">{label}</Link>)}
        </nav>
      </div>
    </header>
  );
}

