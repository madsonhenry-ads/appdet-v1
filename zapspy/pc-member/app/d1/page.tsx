"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Script from "next/script"
import { Loader2, MapPin, AlertTriangle, LockOpen } from 'lucide-react'

// =======================================================
// HELPER COMPONENTS (Mantidos para visualização do mapa)
// =======================================================

const RealtimeMap = ({ lat, lng, city, country }: { lat: number; lng: number; city: string; country: string }) => {
  const mapEmbedUrl = `https://maps.google.com/maps?q=${lat},${lng}&z=13&output=embed`
  return (
    <div className="relative h-64 md:h-80 w-full rounded-lg overflow-hidden shadow-inner border border-gray-200">
      <iframe className="absolute top-0 left-0 w-full h-full border-0" loading="lazy" allowFullScreen src={mapEmbedUrl}></iframe>
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
      <div className="absolute inset-0 p-4 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <span className="bg-gray-800/80 text-white text-xs font-bold py-1 px-3 rounded">GPS TRACKING</span>
          <span className="bg-red-600 text-white text-xs font-bold py-1 px-3 rounded animate-pulse">LIVE</span>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute h-16 w-16 rounded-full bg-red-600/30 animate-ping"></div>
          <div className="relative flex items-center justify-center h-10 w-10 rounded-full bg-red-600 border-2 border-white shadow-xl"><MapPin className="h-5 w-5 text-white" /></div>
        </div>
        <div className="text-white">
          <div className="flex items-center gap-2 font-bold text-red-400"><AlertTriangle className="h-4 w-4" /><span>SUSPICIOUS ACTIVITY</span></div>
          <p className="text-xs md:text-sm text-gray-200">Location: {city}, {country}</p>
        </div>
      </div>
    </div>
  )
}

// =======================================================
// MAIN COMPONENT D1 (Downsell)
// =======================================================

export default function D1() {
  const [timeLeft, setTimeLeft] = useState(4 * 60 + 46); // 04:46 como no print
  const [location, setLocation] = useState<{ lat: number; lng: number; city: string; country: string } | null>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(true)

  // Dados estáticos baseados no print
  const suspiciousKeywords = [
    { word: "Gorgeous", count: 26 },
    { word: "Love", count: 22 },
    { word: "Secret", count: 19 },
    { word: "Hidden", count: 17 },
    { word: "Don't tell", count: 15 },
    { word: "Miss you", count: 12 },
    { word: "Thinking of you", count: 12 },
    { word: "Can't stop thinking", count: 10 },
    { word: "Wish you were here", count: 10 },
    { word: "Baby", count: 10 },
    { word: "Babe", count: 8 },
    { word: "Honey", count: 8 },
    { word: "Darling", count: 7 },
    { word: "Sweetie", count: 7 },
    { word: "Gorgeous", count: 6 },
    { word: "Sexy", count: 6 },
    { word: "Hot", count: 4 },
    { word: "Delete this", count:3 },
    { word: "Delete the messages", count: 2 },
  ]

  const defaultLocation = { lat: 38.7219, lng: -9.1398, city: "Lisbon", country: "Portugal" } // Exemplo do print (Lisboa)

  // Timer Regressivo
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prevTime) => (prevTime > 0 ? prevTime - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Carregar Localização (Simulada ou Real)
  useEffect(() => {
    const fetchLocation = async () => {
      setIsLoadingLocation(true);
      try {
        const response = await fetch('/api/location');
        if (!response.ok) throw new Error('Error');
        const data = await response.json();
        if (data.lat && data.lon) {
          setLocation({ lat: data.lat, lng: data.lon, city: data.city, country: data.country });
        } else {
          setLocation(defaultLocation);
        }
      } catch (error) {
        setLocation(defaultLocation);
      } finally {
        setIsLoadingLocation(false);
      }
    };
    fetchLocation();
  }, []);

  // Inicializar Hotmart Widget
  useEffect(() => {
    if (typeof (window as any).checkoutElements !== 'undefined') {
      try { 
        (window as any).checkoutElements.init('salesFunnel').mount('#hotmart-sales-funnel'); 
      } catch (e) { 
        console.error("Failed to mount Hotmart widget:", e); 
      }
    }
  }, []);

  return (
    <>
      <Script src="https://checkout.hotmart.com/lib/hotmart-checkout-elements.js" strategy="afterInteractive" />

      {/* Faixa de Aviso de Topo */}
      <div className="bg-red-600 text-center py-3 px-4 sticky top-0 z-50 shadow-md">
        <p className="text-sm md:text-base font-bold text-white uppercase tracking-wide animate-pulse">
          ⚠️ WAIT! DO NOT CLOSE THIS PAGE
        </p>
      </div>

      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-start px-4 py-8">
        <main className="w-full max-w-md mx-auto space-y-6">
          
          {/* Cabeçalho de Oferta */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
              Wait! We have a <br/>
              <span className="text-green-600">Special Offer</span> for you.
            </h1>
            <p className="text-gray-600">
              We understand that the price might be an issue. Because the report is already generated, we don't want to delete it.
            </p>
            <div className="inline-block bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg font-bold text-lg mt-2">
              GET 50% OFF RIGHT NOW
            </div>
          </div>

          {/* Container Principal do Relatório (Imitando o Print) */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            
            {/* Seção 1: Keywords Suspeitas */}
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Suspicious Keywords</h2>
              <p className="text-sm text-gray-500 mb-4">
                The system scanned <span className="font-semibold text-red-500">4,327 messages</span> and identified several keywords.
              </p>
              <div className="space-y-2">
                {suspiciousKeywords.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-base font-medium text-gray-700">"{item.word}"</span>
                    <div className="flex items-center justify-center w-6 h-6 bg-green-500 rounded-full text-white text-xs font-bold">
                      {item.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seção 2: Localização Suspeita */}
            <div className="p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Suspicious Location</h2>
              <p className="text-sm text-gray-500 mb-4">
                The device location was tracked. Check below:
              </p>
              
              {isLoadingLocation ? (
                <div className="h-64 w-full bg-gray-200 rounded-lg flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                </div>
              ) : (
                <RealtimeMap 
                  lat={location?.lat ?? defaultLocation.lat} 
                  lng={location?.lng ?? defaultLocation.lng} 
                  city={location?.city ?? defaultLocation.city} 
                  country={location?.country ?? defaultLocation.country} 
                />
              )}
            </div>

            {/* Seção 3: Card de Desbloqueio (Checkout) */}
            <div className="p-6 bg-white relative">
              <div className="text-center mb-6">
                <div className="mx-auto w-14 h-14 rounded-xl bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center mb-3 shadow-lg transform -rotate-3">
                  <LockOpen className="text-white h-7 w-7" />
                </div>
                <h2 className="text-xl font-black text-gray-900 uppercase">Unlock Complete Report</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Get instant access to the full report including deleted messages and photos.
                </p>
              </div>

              {/* Timer de Urgência */}
              <div className="bg-red-50 border border-red-100 text-red-800 p-4 rounded-xl mb-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-xs font-bold tracking-wider text-red-600 uppercase">Report expires in:</span>
                </div>
                <div className="text-4xl font-mono font-bold text-red-600 tracking-tight">
                  {formatTime(timeLeft)}
                </div>
                <p className="text-[10px] text-red-500/80 mt-2 leading-tight px-4">
                  After this time, the data will be permanently deleted from our servers for privacy reasons.
                </p>
              </div>
              
              {/* Widget Hotmart */}
              <div className="w-full bg-gray-50 rounded-lg border border-dashed border-gray-300 min-h-[100px] flex items-center justify-center">
                 {/* O ID aqui deve ser substituído pelo ID do widget de Downsell configurado na Hotmart */}
                 <div id="hotmart-sales-funnel" className="w-full"></div>
              </div>
            </div>

          </div>
          
          <p className="text-center text-xs text-gray-400">
            Secure 256-bit Encryption • 100% Anonymous • Satisfaction Guaranteed
          </p>

        </main>
      </div>
    </>
  )
}
