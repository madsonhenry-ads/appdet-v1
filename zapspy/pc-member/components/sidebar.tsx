"use client"

import Link from "next/link"
import { MessageCircle, Camera, Heart, PlayCircle, CheckSquare, Settings, X } from "lucide-react"

interface SidebarProps {
  open: boolean
  onToggle: () => void
  activeTab: string
}

export default function Sidebar({ open, onToggle, activeTab }: SidebarProps) {
  const homeItem = { id: "home", label: "Home", icon: PlayCircle, path: "/dashboard" }

  const scannerItems = [
    { id: "whatsapp", label: "Whatsapp Scanner", icon: MessageCircle, path: "/dashboard/whatsapp" },
    { id: "instagram", label: "Instagram Scanner", icon: Camera, path: "/dashboard/instagram" },
    { id: "dating", label: "Dating Scanner", icon: Heart, path: "/dashboard/dating" },
  ]

  const advancedItems = [
    { id: "intro", label: "Start Here", icon: PlayCircle, path: "/dashboard/intro" },
    { id: "tutorial", label: "Installation Tutorial", icon: CheckSquare, path: "/dashboard/tutorial" },
    { id: "advanced", label: "Advanced Panel", icon: Settings, path: "/dashboard/scanners" },
  ]

  return (
    <aside
      className={`w-64 bg-card/80 backdrop-blur-md border-r border-border transition-all duration-300 flex flex-col overflow-hidden h-full ${
        open ? "fixed inset-y-0 left-0 z-50" : "hidden md:flex relative"
      }`}
    >
      {/* Logo/Brand Area */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/5">
        <div className="flex flex-col">
          <span className="text-xl font-bold text-blue-500">Scanner Pro</span>
          <span className="text-xs text-zinc-400">Members Area</span>
        </div>
        <button onClick={onToggle} className="md:hidden p-1 text-zinc-400 hover:text-white rounded-md">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto px-4 py-8 space-y-6">

        {/* Category: General */}
        <div>
          <div className="space-y-1">
            <Link
              href={homeItem.path}
              onClick={onToggle}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                activeTab === homeItem.id || activeTab === ""
                  ? "bg-primary/10 text-white border border-primary/20 shadow-[0_0_15px_rgba(41,98,255,0.1)]"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent"
              }`}
            >
              <homeItem.icon className={`w-5 h-5 ${activeTab === homeItem.id || activeTab === "" ? "text-primary" : "text-zinc-500"}`} />
              <span>{homeItem.label}</span>
            </Link>
          </div>
        </div>
        <div>
          <h3 className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Scanner</h3>
          <div className="space-y-1">
            {scannerItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id

              return (
                <Link
                  key={item.id}
                  href={item.path}
                  onClick={onToggle}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-zinc-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-zinc-400"}`} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Category: Advanced Spy */}
        <div>
          <h3 className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Advanced Spy</h3>
          <div className="space-y-1">
            {advancedItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id || (activeTab === "" && item.id === "intro")

              return (
                <Link
                  key={item.id}
                  href={item.path}
                  onClick={onToggle}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-zinc-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-zinc-400"}`} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

      </nav>

      {/* Footer - Clean, no user info */}
      <div className="p-4 border-t border-border bg-background/40 backdrop-blur-sm">
        <p className="text-xs text-zinc-500 text-center">
          AppDetect © 2026
        </p>
      </div>
    </aside>
  )
}
