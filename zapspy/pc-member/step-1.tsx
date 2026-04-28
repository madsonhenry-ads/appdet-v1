"use client"

import { Search, Activity, Instagram, MapPin, Eye, ShieldCheck, Heart, Camera, MessageSquare, Check, CheckCircle, Star, FolderArchive, Users } from 'lucide-react'
import Image from "next/image"
import { useRouter } from 'next/navigation'

// Componente auxiliar para as estrelas
const StarRating = ({ rating = 5 }) => (
  <div className="flex text-yellow-400">
    {Array.from({ length: rating }).map((_, index) => (
      <Star key={index} className="w-5 h-5 fill-current" />
    ))}
  </div>
);

export default function Step1() {
  const router = useRouter();

  const handleNavigate = () => {
    router.push('/step-2'); 
  };

  return (
    <div className="bg-white text-gray-800 font-sans">
      
      {/* =================================== */}
      {/* 1. Hero Section                     */}
      {/* =================================== */}
      <section className="bg-gradient-to-br from-[#1d1d3a] via-[#2a2a4b] to-[#3a2c6b] text-white py-16 px-4 overflow-hidden">
        <div className="container mx-auto max-w-3xl text-center flex flex-col items-center">
          
          <div className="inline-block bg-pink p-4 rounded-2xl shadow-lg mb-6">
      <Instagram className="h-10 w-10 text-white-600" />
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
            Are you feeling that something <span className="text-red-500">isn't right</span> <span className="text-red-500"></span>in your relationship?<br />
          </h1>

          <p className="text-lg text-gray-300 mb-8 max-w-xl">
            With every passing minute, your worst fears may be coming true.
          </p>

          <p className="text-lg text-white font-bold mb-8 max-w-xl">
            Find out the truth in under 2 minutes.
          </p>

          <div className="inline-flex items-center bg-green-900/50 text-green-300 border border-green-700 rounded-full px-4 py-1.5 text-sm mb-8">
            <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>Advanced Detection System - Updated November 2025</span>
          </div>

          <div className="w-full max-w-lg space-y-4 text-left mb-8">
            {/* Item 1 */}
            <div className="bg-white/10 p-4 rounded-lg flex items-start gap-4 border-l-[6px] border-pink-500 shadow-md">
              <div className="text-3xl mt-1">👤</div>
              <div className="text-sm text-gray-200 leading-relaxed">
                <span className="font-bold text-white text-base block mb-1">Stories and posts that "disappeared"?</span>
                Discover content that was purposely hidden from you.
              </div>
            </div>

            {/* Item 2 */}
            <div className="bg-white/10 p-4 rounded-lg flex items-start gap-4 border-l-[6px] border-pink-500 shadow-md">
              <div className="text-3xl mt-1">🔥</div>
              <div className="text-sm text-gray-200 leading-relaxed">
                <span className="font-bold text-white text-base block mb-1">Suspicious likes on intimate photos</span>
                of people you don't even know. Monitor every compromising interaction.
              </div>
            </div>

            {/* Item 3 */}
            <div className="bg-white/10 p-4 rounded-lg flex items-start gap-4 border-l-[6px] border-pink-500 shadow-md">
              <div className="text-3xl mt-1">📸</div>
              <div className="text-sm text-gray-200 leading-relaxed">
                <span className="font-bold text-white text-base block mb-1">Photos and videos saved in hidden folders.</span>
                See what is really being kept.
              </div>
            </div>

            {/* Item 4 */}
            <div className="bg-white/10 p-4 rounded-lg flex items-start gap-4 border-l-[6px] border-pink-500 shadow-md">
              <div className="text-3xl mt-1">💬</div>
              <div className="text-sm text-gray-200 leading-relaxed">
                <span className="font-bold text-white text-base block mb-1">"Deleted" messages recovered.</span>
                Technology doesn't forget. Discover the conversations they tried to hide.
              </div>
            </div>
          </div>

          <button 
            onClick={handleNavigate}
            className="w-full max-w-lg bg-gradient-to-r from-red-500 to-pink-600 hover:opacity-90 text-white font-bold py-4 px-6 rounded-full text-lg shadow-lg transition-transform transform hover:scale-105"
          >
            🔍 DISCOVER THE TRUTH NOW
          </button>
          <p className="text-xs text-gray-400 mt-2">100% anonymous investigation. They'll never know you checked.</p>
        </div>
      </section>

      {/* =================================== */}
      {/* 2. "You're Not Paranoid" Section    */}
      {/* =================================== */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">
            You're Not Paranoid -
          </h2>
          <h3 className="text-3xl md:text-4xl font-bold text-red-500 mb-6">
            You're Protecting Yourself
          </h3>
          <p className="text-gray-500 max-w-2xl mx-auto mb-12">
            Trusting your instincts is not a weakness. It’s emotional intelligence.
          </p>
          <p className="text-lg text-black font-bold mb-8 max-w-xl mx-auto">
            You deserve clarity to make the right decisions.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-lg text-center">
              <div className="inline-block bg-pink-100 p-4 rounded-xl mb-4">
                <Search className="h-8 w-8 text-pink-500" />
              </div>
              <h4 className="font-bold text-lg mb-2">RECENT ACTIVITY</h4>
              <p className="text-gray-500 text-sm">See which profiles the person has interacted with most frequently in recent days.</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg text-center">
              <div className="inline-block bg-purple-100 p-4 rounded-xl mb-4">
                <Users className="h-8 w-8 text-purple-500" />
              </div>
              <h4 className="font-bold text-lg mb-2">PROFILES VISITED </h4>
              <p className="text-gray-500 text-sm">Discover the profiles that are being visited repeatedly and at suspicious times.</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg text-center">
              <div className="inline-block bg-red-100 p-4 rounded-xl mb-4">
                <Camera className="h-8 w-8 text-red-500" />
              </div>
              <h4 className="font-bold text-lg mb-2">LIKED PHOTOS</h4>
              <p className="text-gray-500 text-sm">All the photos they've liked — including the ones they unliked afterward.</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg text-center">
              <div className="inline-block bg-orange-100 p-4 rounded-xl mb-4">
                <MessageSquare className="h-8 w-8 text-orange-500" />
              </div>
              <h4 className="font-bold text-lg mb-2">PRIVATE CONVERSATIONS</h4>
              <p className="text-gray-500 text-sm">See who they’re constantly talking to and what is actually being said.</p>
            </div>
          </div>
        </div>
      </section>

      {/* =================================== */}
      {/* 3. Testimonials Section             */}
      {/* =================================== */}
      <section className="bg-gray-50 py-20 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12">
            Over <span className="text-red-500">127,000 people</span> have already discovered the truth.
          </h2>
          <div className="space-y-8">
            {/* Testimonial 1 */}
            <div className="bg-white p-6 rounded-xl shadow-lg text-left">
              <div className="flex items-center mb-4">
                {/* Certifique-se que o path da imagem existe ou remova se for teste */}
                <Image src="/images/83.jpg" alt="Sarah" width={48} height={48} className="rounded-full mr-4" />
                <div>
                  <p className="font-bold">Sarah, 42</p>
                  <p className="text-sm text-green-600 flex items-center"><Check className="h-4 w-4 mr-1"/>Verified User</p>
                </div>
              </div>
              <blockquote className="text-gray-600 italic mb-4 before:content-['“'] after:content-['”']">
                For 8 months I felt that something was wrong. He denied everything. The tool showed conversations with his 'best friend' that made me cry for days, but it gave me the strength to move on and no longer live in a lie.
              </blockquote>
              <StarRating />
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white p-6 rounded-xl shadow-lg text-left">
              <div className="flex items-center mb-4">
                 <Image src="/images/86.jpg" alt="Jennifer" width={48} height={48} className="rounded-full mr-4" />
                <div>
                  <p className="font-bold">Jennifer, 33</p>
                  <p className="text-sm text-gray-500">Investigation completed November 2025</p>
                </div>
              </div>
              <blockquote className="text-gray-600 italic mb-4 before:content-['“'] after:content-['”']">
                {"I discovered in November 2025 that my fiancé was exchanging intimate messages with 3 different women. I called off the wedding 2 weeks before. It hurt a lot, but it saved me from a mistake that would have destroyed my life."}
              </blockquote>
              <StarRating />
            </div>

            {/* Testimonial 3 */}
            <div className="bg-white p-6 rounded-xl shadow-lg text-left">
              <div className="flex items-center mb-4">
                 <Image src="/images/87.jpg" alt="Michelle" width={48} height={48} className="rounded-full mr-4" />
                <div>
                  <p className="font-bold">Michelle, 35</p>
                  <p className="text-sm text-green-600 flex items-center"><Check className="h-4 w-4 mr-1"/>Verified User</p>
                </div>
              </div>
              <blockquote className="text-gray-600 italic mb-4 before:content-['“'] after:content-['”']">
                My husband swore I was crazy, that they were just work friends. The private profiles were all there — provocative photos he liked at 2 a.m. Now I’m moving forward without any doubts.
              </blockquote>
              <StarRating />
            </div>
          </div>
        </div>
      </section>

      {/* =================================== */}
      {/* 4. Final CTA Section (Dark Theme)   */}
      {/* =================================== */}
      <section className="bg-[#1d1d3a] py-16 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          
          {/* Título Impactante */}
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-8 leading-tight drop-shadow-md">
            You Won't Live Another Day <br className="hidden md:block" />
            With This Anguish in Your Chest
          </h2>

          {/* Botão */}
          <button 
            onClick={handleNavigate}
            className="w-full max-w-lg bg-[#FF4081] hover:bg-[#f53677] text-white font-extrabold py-5 px-6 rounded-full text-lg md:text-xl shadow-[0_10px_40px_-10px_rgba(255,64,129,0.6)] transition-all transform hover:scale-105 flex items-center justify-center gap-3 mx-auto"
          >
            <span className="text-2xl">🔒</span> START ANONYMOUS INVESTIGATION NOW
          </button>

          {/* Textos de Rodapé */}
          <div className="mt-6 space-y-2">
            <p className="text-sm text-gray-300">
              100% anonymous. Your investigation will remain completely private.
            </p>
            <p className="text-sm text-gray-400">
              More than 127,000 people have already discovered the truth.
            </p>
          </div>

        </div>
      </section>

    </div>
  )
}
