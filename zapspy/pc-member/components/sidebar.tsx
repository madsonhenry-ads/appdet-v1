"use client"

import { Home, MessageCircle, Camera, Heart, PlayCircle, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface SidebarProps {
  open: boolean
  onToggle: () => void
  activeTab: string
}

export default function Sidebar({ open, onToggle, activeTab }: SidebarProps) {
  const pathname = usePathname()

  const navItems = [
    { id: "home", label: "Dashboard", icon: Home, href: "/dashboard" },
    { id: "whatsapp", label: "WhatsApp Scanner", icon: MessageCircle, href: "/dashboard/whatsapp" },
    { id: "instagram", label: "Instagram Scanner", icon: Camera, href: "/dashboard/instagram" },
    { id: "dating", label: "Dating Scanner", icon: Heart, href: "/dashboard/dating" },
    { id: "intro", label: "Advanced Spy", icon: PlayCircle, href: "/dashboard/intro" },
  ]

  return (
    <aside className="h-full w-64 bg-[#0f1535] border-r border-[#1e2745] flex flex-col">
      {/* Logo/Brand */}
      <div className="p-4 border-b border-[#1e2745]">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">PC Member</h1>
          {/* Mobile close button */}
          <button
            onClick={onToggle}
            className="md:hidden p-1 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || activeTab === item.id

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? "bg-[#2962FF] text-white"
                      : "text-zinc-400 hover:bg-[#1a1f3a] hover:text-white"
                  }`}
                  onClick={() => {
                    // Close sidebar on mobile after clicking
                    if (open) onToggle()
                  }}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer - No user info */}
      <div className="p-4 border-t border-[#1e2745]">
        <p className="text-xs text-zinc-500 text-center">
          AppDetect © 2026
        </p>
      </div>
    </aside>
  )
}
