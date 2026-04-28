"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import Script from "next/script"
import { Loader2, CheckCircle, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"

// Interface para definir a estrutura de cada passo do progresso
interface ProgressStep {
  id: string
  text: string
  status: "pending" | "loading" | "completed"
}

interface InstagramPost {
  id: string
  media_url: string
  media_type: string
  thumbnail_url?: string
}

export default function Step3() {
  const router = useRouter()

  // Estados para dados vindos do Step 2
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null)
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const [location, setLocation] = useState<string>("Detecting location...")
  const [instagramUsername, setInstagramUsername] = useState<string | null>(null)
  const [instagramPosts, setInstagramPosts] = useState<InstagramPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)

  // Estados para a simulação de carregamento
  const [progress, setProgress] = useState(0)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [visibleSteps, setVisibleSteps] = useState<number>(1)
  const [scanningStatus, setScanningStatus] = useState<string>("")

  // Efeito para buscar dados do localStorage e a localização do usuário ao montar o componente
  useEffect(() => {
    // Recupera dados do Step 2
    const storedPhone = localStorage.getItem("phoneNumber")
    const storedPhoto = localStorage.getItem("profilePhoto")
    const storedProfileData = localStorage.getItem("igProfileCacheV1")

    setPhoneNumber(storedPhone || "Number not found")
    setProfilePhoto(
      storedPhoto ||
        "https://media.istockphoto.com/id/1337144146/vector/default-avatar-profile-icon-vector.jpg?s=612x612&w=0&k=20&c=BIbFwuv7FxTWvh5S3vB6bkT0Qv8Vn8N5Ffseq84ClGI=",
    )

    if (storedProfileData) {
      try {
        const cache = JSON.parse(storedProfileData)
        const username = Object.keys(cache)[0]
        if (username) {
          setInstagramUsername(username)
        }
      } catch (e) {
        console.error("[v0] Error parsing profile cache:", e)
      }
    }

    const fetchLocation = async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch("/api/location", {
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!response.ok) throw new Error("Failed to fetch location from internal API")
        const data = await response.json()

        setLocation(data.city || "Unknown Location")
      } catch (error) {
        console.error("[v0] Location fetch error:", error)
        setLocation("Your Location")
      }
    }

    fetchLocation()
  }, [])

  useEffect(() => {
    if (instagramUsername && !loadingPosts && instagramPosts.length === 0) {
      const fetchPosts = async () => {
        setLoadingPosts(true)
        try {
          const response = await fetch("/api/instagram/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: instagramUsername }),
          })
          const result = await response.json()

          if (result.success && result.posts?.data?.items) {
            // Get first 9 posts for 3x3 grid
            const posts = result.posts.data.items.slice(0, 9).map((item: any) => ({
              id: item.id || Math.random().toString(),
              media_url: item.image_versions2?.candidates?.[0]?.url || item.thumbnail_url || "",
              media_type: item.media_type,
              thumbnail_url: item.image_versions2?.candidates?.[0]?.url || "",
            }))
            setInstagramPosts(posts)
          }
        } catch (error) {
          console.error("[v0] Error fetching Instagram posts:", error)
        } finally {
          setLoadingPosts(false)
        }
      }

      fetchPosts()
    }
  }, [instagramUsername, loadingPosts, instagramPosts.length])

  const steps: ProgressStep[] = useMemo(
    () => [
      { id: "initiating", text: "Initiating connection to Instagram servers...", status: "pending" },
      { id: "checking", text: "Checking profile availability...", status: "pending" },
      { id: "found", text: "Profile found! Validating metadata...", status: "pending" },
      { id: "analyzing", text: "Analyzing recent mentions and interactions...", status: "pending" },
      { id: "searching", text: "Searching for archived stories and screenshots...", status: "pending" },
      { id: "mapping", text: "Mapping conversation patterns in Direct...", status: "pending" },
      { id: "complete", text: "Synchronization completed successfully.", status: "pending" },
    ],
    [],
  )

  const [currentSteps, setCurrentSteps] = useState<ProgressStep[]>([])

  // Inicializa o estado dos passos
  useEffect(() => {
    if (steps.length > 0 && currentSteps.length === 0) {
      setCurrentSteps(steps.map((step, index) => (index === 0 ? { ...step, status: "loading" } : step)))
    }
  }, [steps, currentSteps.length])

  useEffect(() => {
    if (!steps.length || currentSteps.length === 0) return

    const totalDuration = 25 * 1000 // 25 seconds
    const stepInterval = totalDuration / steps.length
    const progressInterval = 100

    setScanningStatus(steps[0]?.text || "")

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressTimer)
          setIsCompleted(true)
          return 100
        }
        return prev + 100 / (totalDuration / progressInterval)
      })
    }, progressInterval)

    const stepTimer = setInterval(() => {
      setCurrentStepIndex((prev) => {
        const nextIndex = prev + 1
        if (nextIndex < steps.length) {
          setCurrentSteps((current) =>
            current.map((step, index) => {
              if (index < nextIndex) return { ...step, status: "completed" }
              if (index === nextIndex) return { ...step, status: "loading" }
              return step
            }),
          )
          setScanningStatus(steps[nextIndex]?.text || "")
          setVisibleSteps(nextIndex + 1)
          return nextIndex
        } else {
          setCurrentSteps((current) => current.map((step) => ({ ...step, status: "completed" })))
          clearInterval(stepTimer)
          return prev
        }
      })
    }, stepInterval)

    return () => {
      clearInterval(progressTimer)
      clearInterval(stepTimer)
    }
  }, [steps, currentSteps.length])

  // Navega para o próximo passo (página 4)
  const handleViewReport = () => {
    const selectedGender = localStorage.getItem("selectedGender") || "male"
    if (selectedGender === "female") {
      router.push("/step-4/female")
    } else {
      router.push("/step-4/male")
    }
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8 gap-6">
        <div className="bg-white rounded-lg shadow-md w-full max-w-md overflow-hidden">
          <div className="p-4">
            <div className="aspect-video rounded-md overflow-hidden shadow-lg bg-black">
              <vturb-smartplayer
                id="vid-690696cdf19aad22a5567aea"
                style={{
                  display: "block",
                  margin: "0 auto",
                  width: "100%",
                }}
              />
            </div>
          </div>

          {/* Seção de Perfil e Progresso */}
          <div className="p-6 pt-2">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-300 mb-3">
                {profilePhoto ? (
                  <Image
                    src={profilePhoto || "/placeholder.svg"}
                    alt="WhatsApp Profile"
                    width={64}
                    height={64}
                    className="object-cover h-full w-full"
                    unoptimized
                  />
                ) : (
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 text-lg mb-1">WhatsApp Profile</h3>
                <p className="text-gray-600 mb-2">{phoneNumber || "Loading number..."}</p>
                <div className="flex items-center justify-center gap-1.5 text-green-600 text-sm">
                  <MapPin className="h-4 w-4" />
                  <span>{location}</span>
                </div>
              </div>
            </div>

            {/* Conteúdo Dinâmico: Carregando ou Completo */}
            {!isCompleted ? (
              // Estado de Carregamento
              <>
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700 font-medium text-sm">
                      <span className="text-green-600 font-mono">[SCANNING]</span>{" "}
                      {currentSteps[currentStepIndex]?.text || "Connecting..."}
                    </span>
                    <span className="text-green-600 font-bold text-sm">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-green-500 h-2.5 rounded-full transition-all duration-100 ease-linear"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>

                {instagramPosts.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-600">
                        <span className="text-yellow-600 font-mono">[STATUS]</span> Searching for connected accounts...
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {instagramPosts.map((post, index) => (
                        <div
                          key={post.id}
                          className="aspect-square rounded-md overflow-hidden bg-gray-200 animate-fade-in"
                          style={{
                            animationDelay: `${index * 0.1}s`,
                          }}
                        >
                          <img
                            src={post.thumbnail_url || post.media_url || "/placeholder.svg"}
                            alt={`Post ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                  {currentSteps.slice(0, visibleSteps).map((step, index) => (
                    <div
                      key={step.id}
                      className={`flex items-start gap-3 text-sm transition-all duration-500 ${
                        index < visibleSteps ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                      }`}
                    >
                      <div className="flex-shrink-0 w-4 h-4 mt-0.5">
                        {step.status === "loading" ? (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        ) : step.status === "completed" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="h-3.5 w-3.5 mt-px rounded-full border-2 border-gray-300"></div>
                        )}
                      </div>
                      <span
                        className={`transition-colors duration-300 ${
                          step.status === "completed"
                            ? "text-green-600 font-medium"
                            : step.status === "loading"
                              ? "text-blue-600 font-medium"
                              : "text-gray-600"
                        }`}
                      >
                        {step.text}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              // Estado Completo
              <div className="text-center py-4 border-t border-gray-200 mt-6">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">Synchronization Complete!</h3>
                <p className="text-gray-600 mb-6">Your private access has been successfully established.</p>
                <Button
                  onClick={handleViewReport}
                  className="w-full h-12 bg-green-500 hover:bg-green-600 text-white text-lg font-medium rounded-lg"
                >
                  View Full Report Now
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="w-full max-w-md text-center py-4">
          <div className="flex justify-center space-x-6 text-sm mb-3">
            <Link href="#" className="text-gray-500 hover:text-blue-500">
              Privacy Policy
            </Link>
            <Link href="#" className="text-gray-500 hover:text-blue-500">
              Terms of Use
            </Link>
            <Link href="#" className="text-gray-500 hover:text-blue-500">
              Email Support
            </Link>
          </div>
          <p className="text-gray-400 text-xs">© 2025 Protect Your Relationship. All rights reserved.</p>
        </footer>
      </div>

      <Script
        id="vturb-player-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var s = document.createElement("script");
              s.src = "https://scripts.converteai.net/8671d2f6-c45f-4b55-9776-68f6c495a79a/players/690696cdf19aad22a5567aea/v4/player.js";
              s.async = true;
              document.head.appendChild(s);
            })();
          `,
        }}
      />

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </>
  )
}
