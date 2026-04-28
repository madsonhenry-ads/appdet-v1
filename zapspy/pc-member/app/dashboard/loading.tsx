import React from 'react'

export default function DashboardLoading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-in fade-in duration-500">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 bg-blue-500/10 rounded-full animate-pulse" />
        </div>
      </div>
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-bold text-white tracking-tight">Loading Content</h3>
        <p className="text-zinc-500 text-xs animate-pulse">Syncing with secure servers...</p>
      </div>

      {/* Skeleton Blocks for layout consistency */}
      <div className="w-full max-w-4xl mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 px-4 pointer-events-none opacity-20">
        <div className="h-48 bg-zinc-800 rounded-xl" />
        <div className="h-48 bg-zinc-800 rounded-xl" />
      </div>
    </div>
  )
}
