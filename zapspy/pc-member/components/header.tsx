"use client"

import { useAuth } from "@/lib/auth-context"
import { Menu } from "lucide-react"

export default function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { user } = useAuth()
  
  // TODO: Use real user name from session/Supabase when ready
  const userName = user?.username || "Madson Papito"

  return (
    <header className="bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-20">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4">
        {/* Left side - Menu button (Mobile only) */}
        <div className="flex items-center md:hidden">
          <button
            onClick={onMenuToggle}
            className="p-2 text-zinc-400 hover:text-white rounded-md transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* For desktop, we don't need a left element since it's clean, but we could put breadcrumbs later */}
        <div className="hidden md:block"></div>

        {/* Right side - Welcome text */}
        <div className="flex flex-col text-right">
          <span className="text-xs text-zinc-400">Welcome</span>
          <span className="text-sm font-bold text-white">{userName}</span>
        </div>
      </div>
    </header>
  )
}

