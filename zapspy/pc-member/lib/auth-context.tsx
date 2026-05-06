"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

interface User {
  id: string
  username: string
  email: string
  photo: string
}

interface AuthContextType {
  user: User | null
  language: "en" | "es"
  setLanguage: (lang: "en" | "es") => void
  logout: () => void
}

// 1. Criamos o contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Usuário fake/invitado para não mostrar erro de login
  const [user, setUser] = useState<User | null>({
    id: "guest",
    username: "Guest",
    email: "guest@appdetect.com",
    photo: "/diverse-user-avatars.png",
  })
  const [language, setLanguageState] = useState<"en" | "es">("en")
  const [isLoaded, setIsLoaded] = useState(true)

  // Carregar preferências de idioma do localStorage se existirem
  useEffect(() => {
    try {
      const storedLanguage = localStorage.getItem("language")
      if (storedLanguage && (storedLanguage === "en" || storedLanguage === "es")) {
        setLanguageState(storedLanguage)
      }
    } catch (error) {
      console.error("Erro ao carregar idioma", error)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  const setLanguage = (lang: "en" | "es") => {
    setLanguageState("en")
    localStorage.setItem("language", "en")
  }

  const logout = () => {
    // Não faz nada - area aberta
    console.log("Usuário saiu (sem necessidade de logout)")
  }

  return (
    <AuthContext.Provider value={{ user, language, setLanguage, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
