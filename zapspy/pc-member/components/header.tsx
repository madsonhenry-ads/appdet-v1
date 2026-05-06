"use client"

import { Menu } from "lucide-react"

// ✅ UPDATED: Remove all user info to show clean interface for open access
// Last updated: 2026-05-06 - removing user name/email from header

export default function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
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

        {/* Right side - Empty (keep clean, no user info) */}
        <div className="hidden md:flex">
          {/* Optional: Add logo or brand here */}
        </div>
      </div>
    </header>
  )
}

