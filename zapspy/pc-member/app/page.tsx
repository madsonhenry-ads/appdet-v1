"use client"

import { useState } from "react"
import { login, signup } from '@/app/auth/actions'

export default function LoginPage() {
  const [lang, setLang] = useState<'en' | 'es'>('en')
  
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const t = {
    en: {
      title: "Access your account",
      subtitle: "Enter your details to access the dashboard",
      emailLabel: "Email Address",
      passwordLabel: "Password",
      btnSignIn: "Sign In",
      btnSignUp: "Sign Up (Create Account)",
      placeholderEmail: "example@email.com",
      placeholderPass: "••••••••",
      modalTitle: "Check your email!",
      modalBody: "We've sent a confirmation link to your email address. Please click the link to activate your account and access the dashboard.",
      modalBtn: "Got it, I'll check it"
    },
    es: {
      title: "Accede a tu cuenta",
      subtitle: "Ingresa tus datos para acceder al panel",
      emailLabel: "Correo Electrónico",
      passwordLabel: "Contraseña",
      btnSignIn: "Entrar",
      btnSignUp: "Registrarse (Crear Cuenta)",
      placeholderEmail: "ejemplo@correo.com",
      placeholderPass: "••••••••",
      modalTitle: "¡Verifica tu correo!",
      modalBody: "Hemos enviado un enlace de confirmación a tu correo electrónico. Por favor haz clic en el enlace para activar tu cuenta y acceder al panel.",
      modalBtn: "Entendido, voy a revisar"
    }
  }

  const text = t[lang]

  const handleSignup = async (formData: FormData) => {
    setLoading(true)
    const result = await signup(formData)
    setLoading(false)

    if (result?.success) {
      setShowModal(true)
    } else {
      alert("Error signing up. Please try again.")
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0a0e27]">
      
      {/* IMAGEM DE FUNDO */}
      <div className="absolute inset-0 z-0 bg-[url('/bg.png')] bg-cover bg-center brightness-50" />

      {/* Botões de Troca de Idioma */}
      <div className="absolute top-5 right-5 z-20 flex gap-2">
        <button 
          onClick={() => setLang('en')}
          className={`px-3 py-1 rounded-full text-sm font-bold transition-all border ${
            lang === 'en' ? 'bg-[#2962FF] text-white border-[#2962FF]' : 'bg-[#1a1f3a]/40 text-white border-[#2962FF]/50 hover:bg-[#1a1f3a]/60'
          }`}
        >
          EN
        </button>
        <button 
          onClick={() => setLang('es')}
          className={`px-3 py-1 rounded-full text-sm font-bold transition-all border ${
            lang === 'es' ? 'bg-[#2962FF] text-white border-[#2962FF]' : 'bg-[#1a1f3a]/40 text-white border-[#2962FF]/50 hover:bg-[#1a1f3a]/60'
          }`}
        >
          ES
        </button>
      </div>

      {/* Cartão de Login */}
      <div className="z-10 w-full max-w-md space-y-8 bg-[#1a1f3a]/95 backdrop-blur-md p-8 shadow-2xl rounded-xl mx-4 border border-[#2a3050]">
        
        <div className="text-center">
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            {text.title}
          </h2>
          <p className="mt-2 text-sm text-[#a0a9c9]">
            {text.subtitle}
          </p>
        </div>

        <form className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white" style={{ fontFamily: 'var(--font-manrope)' }}>
                {text.emailLabel}
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email" 
                  type="email"
                  autoComplete="email"
                  required
                  placeholder={text.placeholderEmail}
                  className="block w-full appearance-none rounded-md border border-[#2a3050] px-3 py-2 bg-[#0a0e27] text-white placeholder-[#6b7280] shadow-sm focus:border-[#2962FF] focus:outline-none focus:ring-2 focus:ring-[#2962FF] sm:text-sm"
                  style={{ fontFamily: 'var(--font-manrope)' }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white" style={{ fontFamily: 'var(--font-manrope)' }}>
                {text.passwordLabel}
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder={text.placeholderPass}
                  className="block w-full appearance-none rounded-md border border-[#2a3050] px-3 py-2 bg-[#0a0e27] text-white placeholder-[#6b7280] shadow-sm focus:border-[#2962FF] focus:outline-none focus:ring-2 focus:ring-[#2962FF] sm:text-sm"
                  style={{ fontFamily: 'var(--font-manrope)' }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              formAction={login}
              className="flex w-full justify-center rounded-md border border-transparent bg-[#2962FF] py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-[#1e47cc] transition-colors"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {text.btnSignIn}
            </button>
            
            <button
              formAction={handleSignup}
              disabled={loading}
              className="flex w-full justify-center rounded-md border border-[#AA00FF] bg-transparent py-2 px-4 text-sm font-medium text-[#AA00FF] shadow-sm hover:bg-[#AA00FF]/10 transition-colors disabled:opacity-50"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {loading ? "..." : text.btnSignUp}
            </button>
          </div>
        </form>
      </div>

      {/* MODAL / POPUP DE SUCESSO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1a1f3a] rounded-lg shadow-2xl max-w-sm w-full p-6 text-center transform transition-all scale-100 border border-[#2a3050]">
            
            {/* Ícone de Email */}
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-[#00E676]/20 mb-4">
              <svg className="h-6 w-6 text-[#00E676]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {text.modalTitle}
            </h3>
            
            <p className="text-sm text-[#a0a9c9] mb-6" style={{ fontFamily: 'var(--font-manrope)' }}>
              {text.modalBody}
            </p>

            <button
              onClick={() => setShowModal(false)}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#2962FF] text-base font-medium text-white hover:bg-[#1e47cc] focus:outline-none sm:text-sm"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {text.modalBtn}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
