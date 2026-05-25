"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect, useRef } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, CheckCircle, Copy, ArrowLeft, ArrowRight } from "lucide-react"

const COUNTRIES = [
  { code: "US", name: "United States", dial: "+1" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "BR", name: "Brazil", dial: "+55" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "IT", name: "Italy", dial: "+39" },
  { code: "ES", name: "Spain", dial: "+34" },
  { code: "MX", name: "Mexico", dial: "+52" },
  { code: "AR", name: "Argentina", dial: "+54" },
  { code: "PT", name: "Portugal", dial: "+351" },
  { code: "NL", name: "Netherlands", dial: "+31" },
  { code: "SE", name: "Sweden", dial: "+46" },
  { code: "NO", name: "Norway", dial: "+47" },
  { code: "DK", name: "Denmark", dial: "+45" },
  { code: "FI", name: "Finland", dial: "+358" },
  { code: "CH", name: "Switzerland", dial: "+41" },
  { code: "BE", name: "Belgium", dial: "+32" },
]

const REASONS_EN = [
  { value: "remorse", label: "Buyer's Remorse / Changed My Mind" },
  { value: "not_working", label: "Product Not Working as Expected" },
  { value: "better_alternative", label: "Found a Better Alternative" },
  { value: "technical", label: "Technical Difficulties / Can't Access" },
  { value: "duplicate", label: "Duplicate / Accidental Purchase" },
  { value: "other", label: "Other Reason" },
]

const REASONS_ES = [
  { value: "remorse", label: "Arrepentimiento / Cambié de Opinión" },
  { value: "not_working", label: "El Producto No Funciona Como Esperaba" },
  { value: "better_alternative", label: "Encontré una Mejor Alternativa" },
  { value: "technical", label: "Problemas Técnicos / No Puedo Acceder" },
  { value: "duplicate", label: "Compra Duplicada / Accidental" },
  { value: "other", label: "Otra Razón" },
]

const PRODUCTS_EN = [
  { value: "whatsapp_scanner", label: "WhatsApp Scanner" },
  { value: "instagram_scanner", label: "Instagram Scanner" },
  { value: "dating_scanner", label: "Dating Scanner" },
  { value: "full_package", label: "Full Package (All Scanners)" },
  { value: "other", label: "Other / Not Sure" },
]

const PRODUCTS_ES = [
  { value: "whatsapp_scanner", label: "WhatsApp Scanner" },
  { value: "instagram_scanner", label: "Instagram Scanner" },
  { value: "dating_scanner", label: "Dating Scanner" },
  { value: "full_package", label: "Paquete Completo (Todos los Scanners)" },
  { value: "other", label: "Otro / No Estoy Seguro" },
]

export default function RefundPage() {
  const { language } = useAuth()
  const isEn = language === "en"
  const t = isEn ? texts.en : texts.es

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [protocol, setProtocol] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [visitorId, setVisitorId] = useState<string | null>(null)

  const [countryCode, setCountryCode] = useState("US")
  const [countryDial, setCountryDial] = useState("+1")
  const [countryOpen, setCountryOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState("")

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    product: "",
    purchaseDate: "",
    reason: "",
    details: "",
  })

  const countryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored =
        (window as any).visitorId ||
        localStorage.getItem("visitorId") ||
        localStorage.getItem("visitor_id") ||
        sessionStorage.getItem("visitorId")
      if (stored) setVisitorId(stored)
    }

    function handleClick(e: MouseEvent) {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.dial.includes(countrySearch)
  )

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function validateStep(s: number): boolean {
    setError(null)
    if (s === 1) {
      if (!form.fullName.trim() || form.fullName.trim().length < 2) {
        setError(t.errorName)
        return false
      }
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        setError(t.errorEmail)
        return false
      }
      if (!form.phone.trim() || form.phone.trim().length < 5) {
        setError(t.errorPhone)
        return false
      }
      if (!form.product) {
        setError(t.errorProduct)
        return false
      }
    }
    if (s === 2) {
      if (!form.purchaseDate) {
        setError(t.errorDate)
        return false
      }
      if (!form.reason) {
        setError(t.errorReason)
        return false
      }
      if (!form.details.trim() || form.details.trim().length < 20) {
        setError(t.errorDetails)
        return false
      }
    }
    return true
  }

  function nextStep() {
    if (validateStep(step)) {
      setStep((s) => s + 1)
      setError(null)
    }
  }

  function prevStep() {
    setStep((s) => s - 1)
    setError(null)
  }

  async function handleSubmit() {
    if (!validateStep(2)) return
    setLoading(true)
    setError(null)

    const generatedProtocol = `RFD-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: `${countryDial} ${form.phone.trim()}`,
        countryCode,
        purchaseDate: form.purchaseDate,
        product: form.product,
        reason: form.reason,
        details: form.details.trim(),
        protocol: generatedProtocol,
        language,
        visitorId,
      }

      const res = await fetch("/api/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit")
      }

      setProtocol(data.protocol || generatedProtocol)
      setStep(3)
    } catch (err: any) {
      setError(err.message || t.errorSubmit)
    } finally {
      setLoading(false)
    }
  }

  function copyProtocol() {
    if (protocol) {
      navigator.clipboard.writeText(protocol)
    }
  }

  return (
    <DashboardLayout activeTab="refund">
      <div className="max-w-2xl mx-auto space-y-6 pb-10">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{t.title}</h1>
          <p className="text-zinc-400 text-sm">{t.subtitle}</p>
        </div>

        {/* Progress Steps */}
        {step < 3 && (
          <div className="flex items-center gap-2">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    s < step
                      ? "bg-green-600 text-white"
                      : s === step
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {s < step ? <CheckCircle className="w-4 h-4" /> : s}
                </div>
                <span
                  className={`text-sm ${s === step ? "text-white font-medium" : "text-zinc-500"}`}
                >
                  {s === 1 ? t.step1Label : t.step2Label}
                </span>
                {s < 2 && <div className="flex-1 h-px bg-zinc-700" />}
              </div>
            ))}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/30 border border-red-800/50 rounded-lg p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                {t.fullName} <span className="text-red-400">*</span>
              </label>
              <Input
                value={form.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                placeholder={t.fullNamePlaceholder}
                className="bg-zinc-800/80 border-zinc-700 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                {t.email} <span className="text-red-400">*</span>
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder={t.emailPlaceholder}
                className="bg-zinc-800/80 border-zinc-700 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                {t.phone} <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <div ref={countryRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setCountryOpen(!countryOpen)}
                    className="h-10 px-3 rounded-lg bg-zinc-800/80 border border-zinc-700 text-white text-sm flex items-center gap-2 hover:bg-zinc-700 transition-colors"
                  >
                    <span>{countryDial}</span>
                    <span className="text-zinc-500">▼</span>
                  </button>
                  {countryOpen && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="p-2">
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder={t.searchCountry}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredCountries.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setCountryCode(c.code)
                              setCountryDial(c.dial)
                              setCountryOpen(false)
                              setCountrySearch("")
                            }}
                            className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-zinc-800 transition-colors ${
                              c.code === countryCode ? "text-blue-400" : "text-zinc-300"
                            }`}
                          >
                            <span>{c.name}</span>
                            <span className="text-zinc-500">{c.dial}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Input
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder={t.phonePlaceholder}
                  className="flex-1 bg-zinc-800/80 border-zinc-700 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                {t.product} <span className="text-red-400">*</span>
              </label>
              <select
                value={form.product}
                onChange={(e) => updateField("product", e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-zinc-800/80 border border-zinc-700 text-white text-sm outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">{t.productPlaceholder}</option>
                {(isEn ? PRODUCTS_EN : PRODUCTS_ES).map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={nextStep} className="bg-blue-600 hover:bg-blue-700 text-white">
                {t.continue}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Purchase Details */}
        {step === 2 && (
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                {t.purchaseDate} <span className="text-red-400">*</span>
              </label>
              <Input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => updateField("purchaseDate", e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="bg-zinc-800/80 border-zinc-700 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                {t.reason} <span className="text-red-400">*</span>
              </label>
              <select
                value={form.reason}
                onChange={(e) => updateField("reason", e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-zinc-800/80 border border-zinc-700 text-white text-sm outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">{t.reasonPlaceholder}</option>
                {(isEn ? REASONS_EN : REASONS_ES).map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                {t.details} <span className="text-red-400">*</span>
              </label>
              <textarea
                value={form.details}
                onChange={(e) => updateField("details", e.target.value)}
                placeholder={t.detailsPlaceholder}
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700 text-white text-sm outline-none focus:border-blue-500 transition-colors resize-none"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {form.details.trim().length} {t.charCount}
                {form.details.trim().length < 20 && (
                  <span className="text-yellow-500"> ({t.charMin})</span>
                )}
              </p>
            </div>

            <div className="flex justify-between pt-2">
              <Button
                onClick={prevStep}
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t.back}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t.submitting}
                  </>
                ) : (
                  t.submit
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Success / Protocol */}
        {step === 3 && protocol && (
          <div className="bg-zinc-900/80 border border-green-800/50 rounded-xl p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-600/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-2">{t.successTitle}</h2>
              <p className="text-zinc-400 text-sm">{t.successDesc}</p>
            </div>

            <div className="bg-zinc-800/80 border border-zinc-700 rounded-lg p-4 inline-block">
              <p className="text-xs text-zinc-500 mb-1">{t.protocolLabel}</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-mono font-bold text-blue-400">{protocol}</span>
                <button
                  onClick={copyProtocol}
                  className="p-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
                  title={t.copy}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 text-left">
              <h3 className="text-sm font-medium text-zinc-300 mb-2">{t.nextStepsTitle}</h3>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">1.</span>
                  <span>{t.nextStep1}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">2.</span>
                  <span>{t.nextStep2}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">3.</span>
                  <span>{t.nextStep3}</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

const texts = {
  en: {
    title: "Request Refund",
    subtitle: "Submit a refund request and we'll review it as soon as possible.",
    step1Label: "Your Info",
    step2Label: "Purchase Details",
    fullName: "Full Name",
    fullNamePlaceholder: "John Doe",
    email: "Email Address",
    emailPlaceholder: "john@example.com",
    phone: "Phone Number",
    phonePlaceholder: "Enter your number",
    searchCountry: "Search country...",
    product: "Product",
    productPlaceholder: "Select a product",
    purchaseDate: "Purchase Date",
    reason: "Reason for Refund",
    reasonPlaceholder: "Select a reason",
    details: "Additional Details",
    detailsPlaceholder: "Tell us more about why you're requesting a refund...",
    charCount: "characters",
    charMin: "minimum 20 characters",
    continue: "Continue",
    back: "Back",
    submit: "Submit Request",
    submitting: "Submitting...",
    successTitle: "Refund Request Submitted!",
    successDesc: "Your refund request has been received. Save your protocol number for reference.",
    protocolLabel: "Your Protocol Number",
    copy: "Copy protocol",
    nextStepsTitle: "What happens next?",
    nextStep1: "Our team will review your request within 24-48 hours.",
    nextStep2: "You'll receive an email with the status of your refund.",
    nextStep3: "If approved, the refund will be processed to your original payment method.",
    errorName: "Please enter your full name.",
    errorEmail: "Please enter a valid email address.",
    errorPhone: "Please enter a valid phone number.",
    errorProduct: "Please select a product.",
    errorDate: "Please select the purchase date.",
    errorReason: "Please select a reason for the refund.",
    errorDetails: "Please provide at least 20 characters of details.",
    errorSubmit: "Failed to submit. Please try again.",
  },
  es: {
    title: "Solicitar Reembolso",
    subtitle: "Envía una solicitud de reembolso y la revisaremos lo antes posible.",
    step1Label: "Tu Información",
    step2Label: "Detalles de Compra",
    fullName: "Nombre Completo",
    fullNamePlaceholder: "Juan Pérez",
    email: "Correo Electrónico",
    emailPlaceholder: "juan@ejemplo.com",
    phone: "Teléfono",
    phonePlaceholder: "Ingresa tu número",
    searchCountry: "Buscar país...",
    product: "Producto",
    productPlaceholder: "Selecciona un producto",
    purchaseDate: "Fecha de Compra",
    reason: "Motivo del Reembolso",
    reasonPlaceholder: "Selecciona un motivo",
    details: "Detalles Adicionales",
    detailsPlaceholder: "Cuéntanos más sobre por qué solicitas el reembolso...",
    charCount: "caracteres",
    charMin: "mínimo 20 caracteres",
    continue: "Continuar",
    back: "Volver",
    submit: "Enviar Solicitud",
    submitting: "Enviando...",
    successTitle: "¡Solicitud Enviada!",
    successDesc: "Tu solicitud de reembolso ha sido recibida. Guarda tu número de protocolo.",
    protocolLabel: "Tu Número de Protocolo",
    copy: "Copiar protocolo",
    nextStepsTitle: "¿Qué sigue?",
    nextStep1: "Nuestro equipo revisará tu solicitud en 24-48 horas.",
    nextStep2: "Recibirás un correo con el estado de tu reembolso.",
    nextStep3: "Si es aprobado, el reembolso se procesará a tu método de pago original.",
    errorName: "Ingresa tu nombre completo.",
    errorEmail: "Ingresa un correo válido.",
    errorPhone: "Ingresa un número de teléfono válido.",
    errorProduct: "Selecciona un producto.",
    errorDate: "Selecciona la fecha de compra.",
    errorReason: "Selecciona un motivo para el reembolso.",
    errorDetails: "Proporciona al menos 20 caracteres de detalles.",
    errorSubmit: "Error al enviar. Intenta de nuevo.",
  },
}