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
  // Inicializamos com valores seguros para não quebrar a página enquanto carrega o localStorage
  const [user, setUser] = useState<User | null>(null)
  const [language, setLanguageState] = useState<"en" | "es">("en")
  
  // O estado isLoaded ainda é útil, mas não vamos impedir o Provider de renderizar
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("dashboardUser")
      const storedLanguage = "en"

      if (storedUser) {
        setUser(JSON.parse(storedUser))
      } else {
        // Usuário Mock Padrão
        const mockUser: User = {
          id: "1",
          username: "John Doe",
          email: "john@example.com",
          photo: "/diverse-user-avatars.png",
        }
        setUser(mockUser)
        // Opcional: Salvar o mock no storage na primeira vez
        localStorage.setItem("dashboardUser", JSON.stringify(mockUser))
      }

      setLanguageState(storedLanguage)
    } catch (error) {
      console.error("Erro ao carregar do localStorage", error)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  const setLanguage = (lang: "en" | "es") => {
    setLanguageState("en")
    localStorage.setItem("language", "en")
  }

  const logout = () => {
    localStorage.removeItem("dashboardUser")
    setUser(null)
  }

  // ✅ CORREÇÃO: Removemos o "if (!isLoaded) return children".
  // Agora o Provider SEMPRE envolve os filhos, impedindo o erro "useAuth must be used within AuthProvider".
  
  return (
    <AuthContext.Provider value={{ user, language, setLanguage, logout }}>
      {/* 
         Opcional: Se quiser que a tela fique branca até carregar o usuário, 
         use: {!isLoaded ? null : children} 
         Mas nunca retorne 'children' sozinho sem o Provider.
      */}
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
