"use client"

import type React from "react"

interface FeatureCardProps {
  title: string
  description: string
  children?: React.ReactNode
}

export default function FeatureCard({ title, description, children }: FeatureCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border shadow-sm p-6">
      <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6">{description}</p>
      {children}
    </div>
  )
}
