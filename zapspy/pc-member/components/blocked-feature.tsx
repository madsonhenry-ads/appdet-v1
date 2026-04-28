"use client"

import { useAuth } from "@/lib/auth-context"
import { translations } from "@/lib/translations"
import { Lock } from "lucide-react"

export default function BlockedFeature() {
  const { language } = useAuth()
  const t = translations[language]

  return (
    <div className="flex flex-col items-center justify-center min-h-96 bg-card rounded-lg border border-border p-8">
      <Lock className="w-16 h-16 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-bold text-foreground mb-2">{t.featureBlocked}</h2>
      <p className="text-muted-foreground text-center">{t.featureUnavailable}</p>
    </div>
  )
}
