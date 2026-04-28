"use client"

// 👇 Garante que o build não quebre por ser página privada
export const dynamic = "force-dynamic"

import { useState, useEffect, useMemo, useRef } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import FeatureCard from "@/components/feature-card"
import { useAuth } from "@/lib/auth-context"
import { translations } from "@/lib/translations"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    CheckCircle,
    Loader2,
    X,
    CheckCheck,
    MessageCircle,
    Search,
    ChevronDown,
    Image as ImageIcon,
    Clock,
    Phone,
    Video,
    MoreVertical
} from 'lucide-react'

// =======================================================
// DADOS MOCKADOS E UTILITÁRIOS
// =======================================================

const countries = [
    { code: "+1", name: "United States", flag: "🇺🇸", placeholder: "(555) 123-4567" },
    { code: "+61", name: "Australia", flag: "🇦🇺", placeholder: "412 345 678" },
    { code: "+1", name: "Canada", flag: "🇨🇦", placeholder: "(555) 123-4567" },
    { code: "+353", name: "Ireland", flag: "🇮🇪", placeholder: "083 123 4567" },
    { code: "+64", name: "New Zealand", flag: "🇳🇿", placeholder: "21 123 4567" },
    { code: "+44", name: "United Kingdom", flag: "🇬🇧", placeholder: "7911 123456" },
    { code: "+33", name: "France", flag: "🇫🇷", placeholder: "6 12 34 56 78" },
    { code: "+34", name: "Spain", flag: "🇪🇸", placeholder: "612 34 56 78" },
    { code: "+52", name: "Mexico", flag: "🇲🇽", placeholder: "55 1234 5678" },
    // --- REST OF THE WORLD (Alphabetical) ---
    { code: "+355", name: "Albania", flag: "🇦🇱", placeholder: "067 123 4567" },
    { code: "+49", name: "Germany", flag: "🇩🇪", placeholder: "1512 3456789" },
    { code: "+376", name: "Andorra", flag: "🇦🇩", placeholder: "606 123 456" },
    { code: "+244", name: "Angola", flag: "🇦🇴", placeholder: "923 123 456" },
    { code: "+966", name: "Saudi Arabia", flag: "🇸🇦", placeholder: "50 123 4567" },
    { code: "+374", name: "Armenia", flag: "🇦🇲", placeholder: "091 123 456" },
    { code: "+297", name: "Aruba", flag: "🇦🇼", placeholder: "560 1234" },
    { code: "+43", name: "Austria", flag: "🇦🇹", placeholder: "664 123456" },
    { code: "+994", name: "Azerbaijan", flag: "🇦🇿", placeholder: "050 123 45 67" },
    { code: "+973", name: "Bahrain", flag: "🇧🇭", placeholder: "3600 1234" },
    { code: "+880", name: "Bangladesh", flag: "🇧🇩", placeholder: "01712 345678" },
    { code: "+32", name: "Belgium", flag: "🇧🇪", placeholder: "470 12 34 56" },
    { code: "+501", name: "Belize", flag: "🇧🇿", placeholder: "622 1234" },
    { code: "+375", name: "Belarus", flag: "🇧🇾", placeholder: "029 123 4567" },
    { code: "+387", name: "Bosnia and Herzegovina", flag: "🇧🇦", placeholder: "061 123 456" },
    { code: "+267", name: "Botswana", flag: "🇧🇼", placeholder: "71 123 456" },
    { code: "+673", name: "Brunei", flag: "🇧🇳", placeholder: "872 1234" },
    { code: "+359", name: "Bulgaria", flag: "🇧🇬", placeholder: "088 123 4567" },
    { code: "+257", name: "Burundi", flag: "🇧🇮", placeholder: "79 123 456" },
    { code: "+975", name: "Bhutan", flag: "🇧🇹", placeholder: "17 123 456" },
    { code: "+55", name: "Brazil", flag: "🇧🇷", placeholder: "(11) 99999-9999" },
    { code: "+855", name: "Cambodia", flag: "🇰🇭", placeholder: "092 123 456" },
    { code: "+974", name: "Qatar", flag: "🇶🇦", placeholder: "3312 3456" },
    { code: "+420", name: "Czechia (Czech Republic)", flag: "🇨🇿", placeholder: "601 123 456" },
    { code: "+86", name: "China", flag: "🇨🇳", placeholder: "138 0013 8000" },
    { code: "+357", name: "Cyprus", flag: "🇨🇾", placeholder: "961 12345" },
    { code: "+379", name: "Vatican City", flag: "🇻🇦", placeholder: "333 123456" },
    { code: "+269", name: "Comoros", flag: "🇰🇲", placeholder: "321 1234" },
    { code: "+850", name: "North Korea", flag: "🇰🇵", placeholder: "191 123 4567" },
    { code: "+82", name: "South Korea", flag: "🇰🇷", placeholder: "10-1234-5678" },
    { code: "+385", name: "Croatia", flag: "🇭🇷", placeholder: "091 123 4567" },
    { code: "+599", name: "Curaçao", flag: "🇨🇼", placeholder: "9 561 1234" },
    { code: "+45", name: "Denmark", flag: "🇩🇰", placeholder: "20 12 34 56" },
    { code: "+246", name: "Diego Garcia", flag: "🇮🇴", placeholder: "380 1234" },
    { code: "+253", name: "Djibouti", flag: "🇩🇯", placeholder: "77 123 456" },
    { code: "+20", name: "Egypt", flag: "🇪🇬", placeholder: "100 123 4567" },
    { code: "+971", name: "United Arab Emirates", flag: "🇦🇪", placeholder: "50 123 4567" },
    { code: "+291", name: "Eritrea", flag: "🇪🇷", placeholder: "07 123 456" },
    { code: "+421", name: "Slovakia", flag: "🇸🇰", placeholder: "0911 123 456" },
    { code: "+386", name: "Slovenia", flag: "🇸🇮", placeholder: "031 123 456" },
    { code: "+372", name: "Estonia", flag: "🇪🇪", placeholder: "501 1234" },
    { code: "+268", name: "Eswatini (Swaziland)", flag: "🇸🇿", placeholder: "761 123 456" },
    { code: "+251", name: "Ethiopia", flag: "🇪🇹", placeholder: "091 123 4567" },
    { code: "+63", name: "Philippines", flag: "🇵🇭", placeholder: "912 345 6789" },
    { code: "+358", name: "Finland", flag: "🇫🇮", placeholder: "50 123 4567" },
    { code: "+679", name: "Fiji", flag: "🇫🇯", placeholder: "920 1234" },
    { code: "+33", name: "France", flag: "🇫🇷", placeholder: "6 12 34 56 78" },
    { code: "+241", name: "Gabon", flag: "🇬🇦", placeholder: "06 12 34 56 78" },
    { code: "+995", name: "Georgia", flag: "🇬🇪", placeholder: "555 12 34 56" },
    { code: "+350", name: "Gibraltar", flag: "🇬🇮", placeholder: "571 12345" },
    { code: "+299", name: "Greenland", flag: "🇬🇱", placeholder: "221234" },
    { code: "+590", name: "Guadeloupe", flag: "🇬🇵", placeholder: "0690 12 34 56" },
    { code: "+594", name: "French Guiana", flag: "🇬🇫", placeholder: "0694 12 34 56" },
    { code: "+245", name: "Guinea-Bissau", flag: "🇬🇼", placeholder: "955 123 456" },
    { code: "+592", name: "Guyana", flag: "🇬🇾", placeholder: "612 3456" },
    { code: "+509", name: "Haiti", flag: "🇭🇹", placeholder: "3412 3456" },
    { code: "+852", name: "Hong Kong", flag: "🇭🇰", placeholder: "6123 4567" },
    { code: "+91", name: "India", flag: "🇮🇳", placeholder: "81234 56789" },
    { code: "+62", name: "Indonesia", flag: "🇮🇩", placeholder: "0812 3456 789" },
    { code: "+964", name: "Iraq", flag: "🇮🇶", placeholder: "0790 123 4567" },
    { code: "+98", name: "Iran", flag: "🇮🇷", placeholder: "0912 345 6789" },
    { code: "+247", name: "Ascension Island", flag: "🇦🇨", placeholder: "650 1234" },
    { code: "+672", name: "Norfolk Island", flag: "🇳🇫", placeholder: "512 1234" },
    { code: "+354", name: "Iceland", flag: "🇮🇸", placeholder: "611 1234" },
    { code: "+500", name: "Falkland Islands", flag: "🇫🇰", placeholder: "51234" },
    { code: "+298", name: "Faroe Islands", flag: "🇫🇴", placeholder: "211234" },
    { code: "+692", name: "Marshall Islands", flag: "🇲🇭", placeholder: "692 1234" },
    { code: "+677", name: "Solomon Islands", flag: "🇸🇧", placeholder: "742 1234" },
    { code: "+972", name: "Israel", flag: "🇮🇱", placeholder: "052-123-4567" },
    { code: "+39", name: "Italy", flag: "🇮🇹", placeholder: "312 345 6789" },
    { code: "+81", name: "Japan", flag: "🇯🇵", placeholder: "90-1234-5678" },
    { code: "+962", name: "Jordan", flag: "🇯🇴", placeholder: "079 123 4567" },
    { code: "+254", name: "Kenya", flag: "🇰🇪", placeholder: "712 123456" },
    { code: "+996", name: "Kyrgyzstan", flag: "🇰🇬", placeholder: "0700 123 456" },
    { code: "+686", name: "Kiribati", flag: "🇰🇮", placeholder: "720 1234" },
    { code: "+383", name: "Kosovo", flag: "🇽🇰", placeholder: "049 123 456" },
    { code: "+965", name: "Kuwait", flag: "🇰🇼", placeholder: "600 12345" },
    { code: "+856", name: "Laos", flag: "🇱🇦", placeholder: "020 1234 5678" },
    { code: "+266", name: "Lesotho", flag: "🇱🇸", placeholder: "501 123 456" },
    { code: "+371", name: "Latvia", flag: "🇱🇻", placeholder: "200 12345" },
    { code: "+961", name: "Lebanon", flag: "🇱🇧", placeholder: "03 123 456" },
    { code: "+423", name: "Liechtenstein", flag: "🇱🇮", placeholder: "660 123 456" },
    { code: "+370", name: "Lithuania", flag: "🇱🇹", placeholder: "601 12345" },
    { code: "+352", name: "Luxembourg", flag: "🇱🇺", placeholder: "621 123 456" },
    { code: "+389", name: "North Macedonia", flag: "🇲🇰", placeholder: "070 123 456" },
    { code: "+853", name: "Macau", flag: "🇲🇴", placeholder: "6612 3456" },
    { code: "+261", name: "Madagascar", flag: "🇲🇬", placeholder: "032 12 345 67" },
    { code: "+60", name: "Malaysia", flag: "🇲🇾", placeholder: "012-345 6789" },
    { code: "+265", name: "Malawi", flag: "🇲🇼", placeholder: "099 123 4567" },
    { code: "+960", name: "Maldives", flag: "🇲🇻", placeholder: "777 1234" },
    { code: "+356", name: "Malta", flag: "🇲🇹", placeholder: "799 12345" },
    { code: "+596", name: "Martinique", flag: "🇲🇶", placeholder: "0696 12 34 56" },
    { code: "+691", name: "Micronesia", flag: "🇫🇲", placeholder: "920 1234" },
    { code: "+373", name: "Moldova", flag: "🇲🇩", placeholder: "068 123 456" },
    { code: "+377", name: "Monaco", flag: "🇲🇨", placeholder: "06 12 34 56 78" },
    { code: "+976", name: "Mongolia", flag: "🇲🇳", placeholder: "8812 3456" },
    { code: "+382", name: "Montenegro", flag: "🇲🇪", placeholder: "067 123 456" },
    { code: "+258", name: "Mozambique", flag: "🇲🇿", placeholder: "82 123 4567" },
    { code: "+264", name: "Namibia", flag: "🇳🇦", placeholder: "081 123 4567" },
    { code: "+674", name: "Nauru", flag: "🇳🇷", placeholder: "555 1234" },
    { code: "+977", name: "Nepal", flag: "🇳🇵", placeholder: "984 123 4567" },
    { code: "+234", name: "Nigeria", flag: "🇳🇬", placeholder: "802 123 4567" },
    { code: "+683", name: "Niue", flag: "🇳🇺", placeholder: "811 1234" },
    { code: "+47", name: "Norway", flag: "🇳🇴", placeholder: "406 12 345" },
    { code: "+687", name: "New Caledonia", flag: "🇳🇨", placeholder: "750 1234" },
    { code: "+64", name: "New Zealand", flag: "🇳🇿", placeholder: "21 123 4567" },
    { code: "+968", name: "Oman", flag: "🇴🇲", placeholder: "921 12345" },
    { code: "+31", name: "Netherlands", flag: "🇳🇱", placeholder: "6 12345678" },
    { code: "+92", name: "Pakistan", flag: "🇵🇰", placeholder: "0300 1234567" },
    { code: "+680", name: "Palau", flag: "🇵🇼", placeholder: "620 1234" },
    { code: "+970", name: "Palestine", flag: "🇵🇸", placeholder: "0599 123 456" },
    { code: "+675", name: "Papua New Guinea", flag: "🇵🇬", placeholder: "723 45678" },
    { code: "+689", name: "French Polynesia", flag: "🇵🇫", placeholder: "87 12 34 56" },
    { code: "+351", name: "Portugal", flag: "🇵🇹", placeholder: "912 345 678" },
    { code: "+48", name: "Poland", flag: "🇵🇱", placeholder: "512 345 678" },
    { code: "+44", name: "United Kingdom", flag: "🇬🇧", placeholder: "7911 123456" },
    { code: "+242", name: "Republic of the Congo", flag: "🇨🇬", placeholder: "06 123 4567" },
    { code: "+243", name: "Democratic Republic of the Congo", flag: "🇨🇩", placeholder: "081 123 4567" },
    { code: "+262", name: "Réunion", flag: "🇷🇪", placeholder: "0692 12 34 56" },
    { code: "+250", name: "Rwanda", flag: "🇷🇼", placeholder: "072 123 4567" },
    { code: "+40", name: "Romania", flag: "🇷🇴", placeholder: "712 123 456" },
    { code: "+7", name: "Russia", flag: "🇷🇺", placeholder: "912 345-67-89" },
    { code: "+685", name: "Samoa", flag: "🇼🇸", placeholder: "722 1234" },
    { code: "+290", name: "Saint Helena", flag: "🇸🇭", placeholder: "659 1234" },
    { code: "+508", name: "Saint Pierre and Miquelon", flag: "🇵🇲", placeholder: "551 1234" },
    { code: "+378", name: "San Marino", flag: "🇸🇲", placeholder: "333 123456" },
    { code: "+239", name: "São Tomé and Príncipe", flag: "🇸🇹", placeholder: "981 1234" },
    { code: "+381", name: "Serbia", flag: "🇷🇸", placeholder: "061 123 4567" },
    { code: "+248", name: "Seychelles", flag: "🇸🇨", placeholder: "2 510 123" },
    { code: "+65", name: "Singapore", flag: "🇸🇬", placeholder: "8123 4567" },
    { code: "+963", name: "Syria", flag: "🇸🇾", placeholder: "093 123 456" },
    { code: "+252", name: "Somalia", flag: "🇸🇴", placeholder: "61 123 4567" },
    { code: "+94", name: "Sri Lanka", flag: "🇱🇰", placeholder: "071 123 4567" },
    { code: "+27", name: "South Africa", flag: "🇿🇦", placeholder: "71 123 4567" },
    { code: "+249", name: "Sudan", flag: "🇸🇩", placeholder: "091 123 4567" },
    { code: "+46", name: "Sweden", flag: "🇸🇪", placeholder: "70-123 45 67" },
    { code: "+41", name: "Switzerland", flag: "🇨🇭", placeholder: "78 123 45 67" },
    { code: "+597", name: "Suriname", flag: "🇸🇷", placeholder: "741 1234" },
    { code: "+66", name: "Thailand", flag: "🇹🇭", placeholder: "081 234 5678" },
    { code: "+886", name: "Taiwan", flag: "🇹🇼", placeholder: "0912 345 678" },
    { code: "+255", name: "Tanzania", flag: "🇹🇿", placeholder: "071 123 4567" },
    { code: "+992", name: "Tajikistan", flag: "🇹🇯", placeholder: "917 123 456" },
    { code: "+670", name: "East Timor", flag: "🇹🇱", placeholder: "771 1234" },
    { code: "+690", name: "Tokelau", flag: "🇹🇰", placeholder: "811 1234" },
    { code: "+676", name: "Tonga", flag: "🇹🇴", placeholder: "771 1234" },
    { code: "+90", name: "Turkey", flag: "🇹🇷", placeholder: "501 234 56 78" },
    { code: "+993", name: "Turkmenistan", flag: "🇹🇲", placeholder: "66 123 4567" },
    { code: "+688", name: "Tuvalu", flag: "🇹🇻", placeholder: "771 1234" },
    { code: "+380", name: "Ukraine", flag: "🇺🇦", placeholder: "50 123 4567" },
    { code: "+256", name: "Uganda", flag: "🇺🇬", placeholder: "070 123 4567" },
    { code: "+998", name: "Uzbekistan", flag: "🇺🇿", placeholder: "90 123 45 67" },
    { code: "+678", name: "Vanuatu", flag: "🇻🇺", placeholder: "778 1234" },
    { code: "+84", name: "Vietnam", flag: "🇻🇳", placeholder: "091 234 56 78" },
    { code: "+681", name: "Wallis and Futuna", flag: "🇼🇫", placeholder: "721 1234" },
    { code: "+967", name: "Yemen", flag: "🇾🇪", placeholder: "711 123 456" },
    { code: "+260", name: "Zambia", flag: "🇿🇲", placeholder: "095 123 4567" },
    { code: "+263", name: "Zimbabwe", flag: "🇿🇼", placeholder: "071 123 456" },
]

const loadingStepsList = [
    { id: "initiating", text: "Initiating connection..." },
    { id: "locating", text: "Locating nearest server..." },
    { id: "establishing", text: "Establishing secure connection..." },
    { id: "verifying", text: "Verifying phone number..." },
    { id: "valid", text: "Valid phone number detected" },
    { id: "analyzing", text: "Analyzing database..." },
    { id: "fetching", text: "Fetching backup files (1.2GB)..." },
    { id: "decrypting", text: "Decrypting message history..." },
    { id: "media", text: "Recovering deleted media..." },
    { id: "complete", text: "Synchronization complete!" },
]

// Componente do Popup de Chat (ATUALIZADO PARA SUPORTAR IMAGENS)
const ChatPopup = ({ onClose, profilePhoto, conversationData, conversationName }: any) => {
    const chatEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [])

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200" onClick={onClose}>
            <div className="relative bg-[#0B141A] rounded-lg shadow-2xl max-w-sm w-full overflow-hidden flex flex-col h-[600px] border border-[#202C33]" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-[#202C33] text-[#E9EDEF] p-3 flex items-center gap-3 shadow-md z-10">
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors"><X className="h-5 w-5" /></button>
                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gray-600 border border-white/10">
                        <img src={profilePhoto || "/placeholder.svg"} alt="Profile" className="object-cover h-full w-full" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-semibold text-sm leading-tight truncate">{conversationName}</span>
                        <span className="text-xs text-emerald-400">online</span>
                    </div>
                    <div className="flex gap-4 text-[#E9EDEF]/80">
                        <Video size={22} />
                        <Phone size={20} />
                        <MoreVertical size={20} />
                    </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 p-4 space-y-2 overflow-y-auto bg-[#0B141A] relative">
                    {/* Dark mode WA background pattern overlay */}
                    <div className="absolute inset-0 opacity-[0.06] bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat pointer-events-none" />
                    
                    <div className="relative z-10 space-y-2">
                        {conversationData.map((msg: any, index: number) => (
                            msg.type === "dateSeparator" ? (
                                // Date Separator
                                <div key={index} className="flex justify-center my-3">
                                    <span className="bg-[#182229] text-[#8696A0] text-[11px] px-3 py-1 rounded-lg shadow-sm font-medium">
                                        {msg.content}
                                    </span>
                                </div>
                            ) : msg.type === "incoming" ? (
                                <div key={index} className="flex justify-start mb-1">
                                    <div className="bg-[#202C33] rounded-lg rounded-tl-none p-2 px-2 max-w-[85%] shadow-sm relative text-[#E9EDEF]">
                                        {/* Lógica para Imagem ou Texto */}
                                        {msg.image ? (
                                            <div className="mb-1 rounded-lg overflow-hidden">
                                                <img src={msg.image} alt="Photo" className="w-full h-auto object-cover" />
                                            </div>
                                        ) : (
                                            <p className={`text-[14px] leading-snug px-1 pt-1`}>
                                                {msg.content}
                                            </p>
                                        )}
                                        <span className="text-[10px] text-[#8696A0] float-right mt-0.5 ml-2 select-none">{msg.time}</span>
                                    </div>
                                </div>
                            ) : (
                                <div key={index} className="flex justify-end mb-1">
                                    <div className="bg-[#005C4B] rounded-lg rounded-tr-none p-2 px-2 max-w-[85%] shadow-sm relative text-[#E9EDEF]">
                                        {/* Lógica para Imagem ou Texto (Outgoing) */}
                                        {msg.image ? (
                                            <div className="mb-1 rounded-lg overflow-hidden">
                                                <img src={msg.image} alt="Photo" className="w-full h-auto object-cover" />
                                            </div>
                                        ) : (
                                            <p className={`text-[14px] leading-snug px-1 pt-1`}>
                                                {msg.content}
                                            </p>
                                        )}
                                        <div className="flex items-center justify-end gap-1 mt-0.5 select-none">
                                            <span className="text-[10px] text-[#8696A0]">{msg.time}</span>
                                            <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                                        </div>
                                    </div>
                                </div>
                            )
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                </div>

                {/* Footer Fake Input */}
                <div className="bg-[#202C33] p-2 flex items-center gap-2 z-10">
                    <div className="flex-1 bg-[#2A3942] rounded-full h-10 px-4 flex items-center text-[#8696A0] text-sm shadow-sm cursor-not-allowed">
                        Type a message
                    </div>
                    <div className="w-10 h-10 bg-[#00A884] rounded-full flex items-center justify-center text-white shadow-sm hover:bg-[#00A884]/80">
                        <MessageCircle size={20} />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function WhatsAppScannerPage() {
    const { language } = useAuth()
    const t = translations[language || "en"]

    // --- ESTADOS ---
    const [step, setStep] = useState(1) // 1: Input, 2: Loading, 3: Results
    const [selectedGender, setSelectedGender] = useState<'Male' | 'Female' | 'Non-binary' | null>(null);
    const [phoneNumber, setPhoneNumber] = useState("")
    const [selectedCountry, setSelectedCountry] = useState(countries[0]) // Default US
    const [showCountryDropdown, setShowCountryDropdown] = useState(false)
    const [countrySearch, setCountrySearch] = useState("")

    // Loading & Photo
    const [progress, setProgress] = useState(0)
    const [currentStepText, setCurrentStepText] = useState(loadingStepsList[0].text)
    const [completedSteps, setCompletedSteps] = useState<string[]>([])
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
    const [isLoadingPhoto, setIsLoadingPhoto] = useState(false)

    // Results
    const [resultTab, setResultTab] = useState<"chats" | "media">("chats")
    const [selectedConvoIndex, setSelectedConvoIndex] = useState<number | null>(null)
    const [countdownString, setCountdownString] = useState("6d 23h 59m")

    const debounceTimeout = useRef<NodeJS.Timeout | null>(null)

    // --- LÓGICA DO TIMER (User Specific) ---
    useEffect(() => {
        // Apenas roda no cliente
        const STORAGE_KEY = "user_first_wa_scan_access";
        let firstAccess = localStorage.getItem(STORAGE_KEY);

        if (!firstAccess) {
            firstAccess = Date.now().toString();
            localStorage.setItem(STORAGE_KEY, firstAccess);
        }

        const targetDate = parseInt(firstAccess) + (7 * 24 * 60 * 60 * 1000);

        const timerInterval = setInterval(() => {
            const now = Date.now();
            const difference = targetDate - now;

            if (difference <= 0) {
                setCountdownString("0d 00h 00m (Updating...)");
                return;
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

            setCountdownString(`${days}d ${hours}h ${minutes}m`);
        }, 1000);

        return () => clearInterval(timerInterval);
    }, []);

    // --- GERADOR DE DADOS DINÂMICOS ---
    const { reportConversations, reportMedia } = useMemo(() => {
        const isTargetMale = selectedGender === 'Male';

        // CORREÇÃO DE GÊNERO:
        const mediaFolder = isTargetMale ? 'male' : 'female';

        // Imagens para a galeria
        const media = Array.from({ length: 9 }).map((_, i) => `/images/${mediaFolder}/perfil/${i + 1}.jpg`);

        const chatAvatars = [
            `/images/${mediaFolder}/perfil/5.jpg`,
            `/images/${mediaFolder}/perfil/6.jpg`,
            `/images/${mediaFolder}/perfil/7.jpg`,
            `/images/${mediaFolder}/perfil/8.jpg`
        ];

        const names = isTargetMale
            ? ["Unknown Number", "Secret 🔒", "Julia Gym", "Work (Ana)"]
            : ["Unknown Number", "Secret 🔒", "Mark Gym", "Work (Daniel)"];

        // -------------------------------------------------------------
        // SCRIPT 1: ALVO HOMEM (MALE) TRAINDO COM MULHER
        // -------------------------------------------------------------
        const CHAT_FOR_MALE_TARGET = [
            { "type": "incoming", "content": "Heyyy, you free tonight? 😏", "time": "10:20 AM" },
            { "type": "outgoing", "content": "Depends… what kinda trouble you planning this time?", "time": "10:21 AM" },
            { "type": "incoming", "content": "Got a surprise you’re gonna fucking love…", "time": "10:22 AM" },
            { "type": "incoming", "content": "But I only deliver in person 😉", "time": "10:22 AM" },
            { "type": "outgoing", "content": "Fuck, you know I can’t say no when you talk like that", "time": "10:24 AM" },
            { "type": "outgoing", "content": "What time can you sneak out?", "time": "10:24 AM" },
            { "type": "incoming", "content": "I can make it happen after 9… hubby thinks I’m at my sister’s lmao", "time": "10:26 AM" },
            { "type": "incoming", "content": "And you? What lie you feeding your girl tonight? 😈", "time": "10:26 AM" },
            { "type": "outgoing", "content": "Last-minute work meeting, she’s used to it by now", "time": "10:28 AM" },
            { "type": "outgoing", "content": "Same motel or wanna switch it up?", "time": "10:28 AM" },
            { "type": "incoming", "content": "Mmm same one’s fine… I literally dreamed about you waiting in that dark blue dress shirt this week", "time": "10:30 AM" },
            { "type": "incoming", "content": "The one I love ripping the buttons off 😂", "time": "10:30 AM" },
            { "type": "outgoing", "content": "Jesus woman you’re killing me already", "time": "10:32 AM" },
            { "type": "outgoing", "content": "Send a pic so I can start getting hard?", "time": "10:32 AM" },

            // IMAGEM SUBSTITUINDO O TEXTO CONFORME PEDIDO
            { "type": "incoming", "image": "/images/male/zap/chat/male-chat.jpg", "time": "10:35 AM" },

            { "type": "incoming", "content": "Just so you don’t forget what’s waiting for you tonight 🔥", "time": "10:35 AM" },
            { "type": "outgoing", "content": "Already saved in the hidden folder lol", "time": "10:37 AM" },
            { "type": "outgoing", "content": "9:30 I’ll pick you up at the usual spot. Don’t you dare be late", "time": "10:37 AM" },
            { "type": "incoming", "content": "Wouldn’t miss it for the world. Counting the minutes already…", "time": "10:38 AM" },
            { "type": "incoming", "content": "And wear that fucking cologne that drives me insane", "time": "10:38 AM" },
            { "type": "outgoing", "content": "Done. Now go act normal before someone sees you grinning like that", "time": "10:40 AM" },
            { "type": "incoming", "content": "Impossible when I’m thinking about what we’re gonna do 😈", "time": "10:41 AM" },
            { "type": "incoming", "content": "See you tonight, you dirty fuck. Kiss where you know…", "time": "10:41 AM" },
            { "type": "outgoing", "content": "Fuck, can’t wait ❤️", "time": "10:42 AM" }
        ]

        // -------------------------------------------------------------
        // SCRIPT 2: ALVO MULHER (FEMALE) TRAINDO COM HOMEM
        // -------------------------------------------------------------
        const CHAT_FOR_FEMALE_TARGET = [
            { "type": "incoming", "content": "Hey trouble… still married? 😈", "time": "2:14 PM" },
            { "type": "incoming", "content": "Been thinking about that tight little dress you wore last time", "time": "2:15 PM" },
            { "type": "outgoing", "content": "Unfortunately still married lol", "time": "2:17 PM" },
            { "type": "outgoing", "content": "And yeah I wore it on purpose… knew you couldn’t take your eyes off me", "time": "2:17 PM" },
            { "type": "incoming", "content": "Worked. I jerked off thinking about bending you over in it twice this week", "time": "2:19 PM" },
            { "type": "outgoing", "content": "Fuck… don’t say that, I’m at work getting wet already", "time": "2:20 PM" },
            { "type": "outgoing", "content": "When are you gonna let me feel you again?", "time": "2:20 PM" },
            { "type": "incoming", "content": "Tonight if you’re brave enough", "time": "2:22 PM" },
            { "type": "incoming", "content": "I’ll book the usual room. 9 PM. Bring that red lipstick", "time": "2:22 PM" },
            { "type": "outgoing", "content": "I’m already shaking", "time": "2:24 PM" },
            { "type": "outgoing", "content": "I’ll tell my husband I’m having drinks with the girls… he’ll never know", "time": "2:24 PM" },
            { "type": "incoming", "content": "Good girl", "time": "2:25 PM" },
            { "type": "incoming", "content": "No panties tonight. I wanna slide right in the second the door closes", "time": "2:25 PM" },
            { "type": "outgoing", "content": "Already decided that this morning 😈", "time": "2:26 PM" },
            { "type": "outgoing", "content": "Been wet since you texted", "time": "2:26 PM" },
            { "type": "incoming", "content": "Send me something to get me through the day", "time": "2:28 PM" },
            { "type": "incoming", "image": "/images/female/zap/chat/female-chat.jpg", "time": "2:31 PM" },
            { "type": "outgoing", "content": "This pussy is yours tonight", "time": "2:31 PM" },
            { "type": "incoming", "content": "Jesus fucking Christ", "time": "2:32 PM" },
            { "type": "incoming", "content": "Room 512. 9 sharp. I’m gonna ruin you", "time": "2:32 PM" },
            { "type": "outgoing", "content": "Counting the hours baby", "time": "2:33 PM" },
            { "type": "outgoing", "content": "I’m gonna scream your name so loud tonight", "time": "2:33 PM" },
            { "type": "incoming", "content": "That’s the plan ❤️", "time": "2:34 PM" }
        ]

        const conversations = [
            {
                img: chatAvatars[0],
                name: names[0],
                time: isTargetMale ? "10:42 AM" : "2:34 PM",
                lastMsg: isTargetMale ? "Fuck, can't wait ❤️" : "That's the plan ❤️",
                chatData: isTargetMale ? CHAT_FOR_MALE_TARGET : CHAT_FOR_FEMALE_TARGET
            },
            // CONVERSAS EXPANDIDAS COM MÚLTIPLOS DIAS
            {
                img: chatAvatars[1],
                name: names[1],
                time: "Yesterday",
                lastMsg: "📷 Photo",
                chatData: [
                    // 3 DAYS AGO
                    { type: "dateSeparator", content: "3 days ago", time: "" },
                    { type: "incoming", content: "Hey... you there?", time: "9:30 PM" },
                    { type: "outgoing", content: "Yeah what's up", time: "9:35 PM" },
                    { type: "incoming", content: "I need to see you. Soon.", time: "9:36 PM" },
                    { type: "outgoing", content: "This week is crazy... maybe friday?", time: "9:40 PM" },
                    { type: "incoming", content: "Friday works. Same place?", time: "9:41 PM" },
                    { type: "outgoing", content: "You know it 😏", time: "9:42 PM" },
                    // 2 DAYS AGO  
                    { type: "dateSeparator", content: "2 days ago", time: "" },
                    { type: "incoming", content: "Can't stop thinking about friday", time: "1:15 PM" },
                    { type: "outgoing", content: "Me neither... counting the days", time: "1:20 PM" },
                    { type: "incoming", content: "What are you wearing rn?", time: "1:22 PM" },
                    { type: "outgoing", content: "At work lol, nothing exciting", time: "1:25 PM" },
                    { type: "incoming", content: "Send me something anyway 🥵", time: "1:26 PM" },
                    { type: "outgoing", content: "You're insatiable... fine, later tonight", time: "1:30 PM" },
                    // YESTERDAY
                    { type: "dateSeparator", content: "Yesterday", time: "" },
                    { type: "incoming", content: "Did you delete the photos?", time: "11:45 PM" },
                    { type: "outgoing", content: "Yes, don't worry", time: "11:47 PM" },
                    { type: "incoming", content: "Check this one before I delete it", time: "11:50 PM" },
                    { type: "outgoing", content: "Holy shit... save that for friday", time: "11:52 PM" },
                    { type: "incoming", content: "It's all yours baby 💋", time: "11:53 PM" }
                ]
            },
            {
                img: chatAvatars[2],
                name: names[2],
                time: "Yesterday",
                lastMsg: "Missed voice call",
                chatData: [
                    // 4 DAYS AGO
                    { type: "dateSeparator", content: "4 days ago", time: "" },
                    { type: "incoming", content: "Great workout today 💪", time: "7:45 PM" },
                    { type: "outgoing", content: "Yeah you killed it! Those squats tho 👀", time: "7:50 PM" },
                    { type: "incoming", content: "Lol you were staring", time: "7:51 PM" },
                    { type: "outgoing", content: "Can you blame me?", time: "7:52 PM" },
                    { type: "incoming", content: "We should do private sessions 😏", time: "7:55 PM" },
                    { type: "outgoing", content: "I'd like that", time: "7:56 PM" },
                    // 2 DAYS AGO
                    { type: "dateSeparator", content: "2 days ago", time: "" },
                    { type: "outgoing", content: "You coming to gym today?", time: "5:30 PM" },
                    { type: "incoming", content: "Yesss, meet me in the back room after?", time: "5:35 PM" },
                    { type: "outgoing", content: "The storage room? You're bad", time: "5:36 PM" },
                    { type: "incoming", content: "You love it", time: "5:37 PM" },
                    { type: "outgoing", content: "Can't deny that 🔥", time: "5:38 PM" },
                    // YESTERDAY
                    { type: "dateSeparator", content: "Yesterday", time: "" },
                    { type: "incoming", content: "Where are you?", time: "4:00 PM" },
                    { type: "outgoing", content: "On my way", time: "4:05 PM" },
                    { type: "incoming", content: "Hurry up! I'm already wet/hard... 🔥", time: "4:10 PM" },
                    { type: "outgoing", content: "5 min away, don't start without me", time: "4:12 PM" },
                    { type: "incoming", content: "No promises 😈", time: "4:13 PM" }
                ]
            },
            {
                img: chatAvatars[3],
                name: names[3],
                time: "2 days ago",
                lastMsg: "Call me when you can",
                chatData: [
                    // 5 DAYS AGO
                    { type: "dateSeparator", content: "5 days ago", time: "" },
                    { type: "incoming", content: "That meeting was so boring, right?", time: "3:30 PM" },
                    { type: "outgoing", content: "Ugh yes, I kept looking at you to stay awake 😂", time: "3:35 PM" },
                    { type: "incoming", content: "I noticed 👀 caught you staring at my legs", time: "3:36 PM" },
                    { type: "outgoing", content: "Guilty... those heels do something to me", time: "3:38 PM" },
                    { type: "incoming", content: "Come to my office. Door's locked.", time: "3:40 PM" },
                    { type: "outgoing", content: "On my way", time: "3:41 PM" },
                    // 3 DAYS AGO
                    { type: "dateSeparator", content: "3 days ago", time: "" },
                    { type: "outgoing", content: "I can still smell your perfume on my shirt", time: "10:20 PM" },
                    { type: "incoming", content: "That's the idea... so you think of me", time: "10:25 PM" },
                    { type: "outgoing", content: "Like I could ever stop", time: "10:26 PM" },
                    { type: "incoming", content: "Tomorrow. Lunch break. Our spot.", time: "10:30 PM" },
                    { type: "outgoing", content: "I'll be there early", time: "10:31 PM" },
                    // 2 DAYS AGO
                    { type: "dateSeparator", content: "2 days ago", time: "" },
                    { type: "outgoing", content: "I can't talk right now, spouse is here", time: "2:00 PM" },
                    { type: "incoming", content: "It's urgent. We need to talk about us.", time: "2:05 PM" },
                    { type: "incoming", content: "Call me when you can", time: "2:06 PM" },
                    { type: "outgoing", content: "Give me an hour. I'll find an excuse", time: "2:10 PM" },
                    { type: "incoming", content: "Ok. I'll be waiting.", time: "2:11 PM" }
                ]
            },
        ];

        return { reportConversations: conversations, reportMedia: media };
    }, [selectedGender]);

    const filteredCountries = useMemo(() => countries.filter((c) => c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.includes(countrySearch)), [countrySearch])

    // --- ACTIONS ---
    const fetchWhatsAppPhoto = async (phoneInput: string, countryInput: string) => {
        setIsLoadingPhoto(true)
        setProfilePhoto(null)

        try {
            const response = await fetch("/api/whatsapp-photo", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    phone: phoneInput,
                    countryCode: countryInput
                }),
            })

            const data = await response.json()

            if (data.success && data.result) {
                setProfilePhoto(data.result)
            } else {
                console.log("No photo found")
            }
        } catch (error) {
            console.error("Error fetching photo:", error)
        } finally {
            setIsLoadingPhoto(false)
        }
    }

    const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value
        const formatted = rawValue.replace(/[^0-9]/g, "")
        setPhoneNumber(formatted)

        if (debounceTimeout.current) clearTimeout(debounceTimeout.current)

        debounceTimeout.current = setTimeout(() => {
            if (formatted.length >= 8) {
                fetchWhatsAppPhoto(formatted, selectedCountry.code)
            }
        }, 1200)
    }

    // Tenta buscar novamente se mudar o país
    useEffect(() => {
        if (phoneNumber.length >= 8) {
            fetchWhatsAppPhoto(phoneNumber, selectedCountry.code)
        }
    }, [selectedCountry])

    const handleStartClone = (e?: React.MouseEvent) => {
        if (e) e.preventDefault();
        if (!phoneNumber) return;

        setStep(2)
        setProgress(0)
        setCompletedSteps([])

        let currentStepIdx = 0
        const totalDuration = 12000
        const stepDuration = totalDuration / loadingStepsList.length

        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) return 100
                return prev + (100 / (totalDuration / 100))
            })
        }, 100)

        const stepInterval = setInterval(() => {
            currentStepIdx++
            if (currentStepIdx < loadingStepsList.length) {
                setCompletedSteps(prev => [...prev, loadingStepsList[currentStepIdx - 1].id])
                setCurrentStepText(loadingStepsList[currentStepIdx].text)
            } else {
                clearInterval(stepInterval)
                clearInterval(interval)
                setStep(3)
            }
        }, stepDuration)
    }

    // --- RENDERS ---

    const renderStep1 = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">1. Select Target's Gender</h3>
                <div className="grid grid-cols-3 gap-3">
                    {["Male", "Female", "Non-binary"].map((g) => (
                        <button
                            key={g}
                            onClick={() => setSelectedGender(g as any)}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all hover:scale-105 ${selectedGender === g
                                ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                : "border-border bg-card hover:border-primary/50"
                                }`}
                        >
                            <span className="text-3xl">{g === "Male" ? "👨🏻" : g === "Female" ? "👩🏻" : "🧑🏻"}</span>
                            <span className="font-medium text-sm text-foreground">{g}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">2. Enter WhatsApp Number</h3>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                            className="flex items-center gap-2 h-12 px-3 border border-border rounded-lg bg-card hover:bg-secondary/50 min-w-[100px]"
                        >
                            <span className="text-xl">{selectedCountry.flag}</span>
                            <span className="text-sm font-medium text-foreground">{selectedCountry.code}</span>
                            <ChevronDown size={14} className="text-muted-foreground" />
                        </button>

                        {showCountryDropdown && (
                            <div className="absolute top-full left-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 w-64 max-h-60 overflow-y-auto">
                                <div className="p-2 sticky top-0 bg-card border-b border-border">
                                    <Input
                                        value={countrySearch}
                                        onChange={e => setCountrySearch(e.target.value)}
                                        placeholder="Search..."
                                        className="h-8 text-xs"
                                    />
                                </div>
                                {filteredCountries.map((c, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { setSelectedCountry(c); setShowCountryDropdown(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-secondary text-left text-sm"
                                    >
                                        <span>{c.flag}</span>
                                        <span className="truncate flex-1 text-foreground">{c.name}</span>
                                        <span className="text-muted-foreground text-xs">{c.code}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <Input
                        type="tel"
                        placeholder={selectedCountry.placeholder}
                        value={phoneNumber}
                        onChange={handlePhoneInputChange}
                        className="h-12 text-lg"
                    />
                </div>

                <div className="min-h-[60px] flex items-center justify-center">
                    {isLoadingPhoto ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin h-4 w-4" /> Searching Whatsapp database...</div>
                    ) : profilePhoto ? (
                        <div className="flex items-center gap-3 bg-primary/10 p-2 pr-4 rounded-full border border-primary/20 animate-in fade-in slide-in-from-bottom-2">
                            <img src={profilePhoto} className="w-10 h-10 rounded-full object-cover border border-primary/50" alt="profile" />
                            <div>
                                <p className="text-xs font-bold text-primary animate-pulse">MATCH DETECTED</p>
                                <p className="text-xs text-muted-foreground font-mono">ID: {phoneNumber.slice(-4)}</p>
                            </div>
                            <CheckCircle className="h-4 w-4 text-primary ml-auto" />
                        </div>
                    ) : phoneNumber.length >= 8 && (
                        <div className="text-xs text-muted-foreground animate-pulse">Intercepting signals...</div>
                    )}
                </div>
            </div>

            <Button
                type="button"
                onClick={handleStartClone}
                disabled={!phoneNumber || !selectedGender || isLoadingPhoto}
                className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/80 text-primary-foreground shadow-lg shadow-primary/20"
            >
                Start WhatsApp Scan 🚀
            </Button>
        </div>
    )

    const renderStep2 = () => (
        <div className="space-y-6 animate-fade-in py-4">
            <div className="text-center space-y-4">
                <div className="mx-auto w-20 h-20 bg-secondary rounded-full flex items-center justify-center border-4 border-card shadow-lg relative overflow-hidden">
                    <img src={profilePhoto || "/placeholder.svg"} className="w-full h-full object-cover opacity-80" alt="target" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    </div>
                </div>
                <div>
                    <h3 className="font-bold text-lg text-primary animate-pulse">Extracting Data...</h3>
                    <p className="text-sm text-muted-foreground font-mono">{selectedCountry.code} {phoneNumber}</p>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono font-medium text-muted-foreground">
                    <span>PROGRESS</span>
                    <span className="text-primary">{Math.round(progress)}%</span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden border border-border">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-center text-xs text-primary font-mono animate-pulse mt-2">
                    {currentStepText}
                </p>
            </div>

            <div className="bg-card rounded-lg p-3 max-h-40 overflow-hidden border border-border">
                <div className="space-y-2">
                    {[...loadingStepsList].reverse().map((step) => {
                        const isCompleted = completedSteps.includes(step.id);
                        const isCurrent = step.text === currentStepText;
                        if (!isCompleted && !isCurrent) return null;
                        return (
                            <div key={step.id} className="flex items-center gap-2 text-xs font-mono">
                                {isCompleted ? <CheckCircle size={12} className="text-primary" /> : <Loader2 size={12} className="animate-spin text-primary/50" />}
                                <span className={isCurrent ? "font-bold text-foreground" : "text-muted-foreground"}>{step.text}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )

    const renderStep3 = () => (
        <div className="space-y-6 animate-fade-in pb-4">
            <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg flex items-center justify-center gap-2 text-primary font-bold animate-pulse">
                <CheckCircle className="h-5 w-5" /> Backup Cloned Successfully
            </div>

            {/* Abas de Navegação */}
            <div className="flex p-1 bg-secondary rounded-xl overflow-x-auto no-scrollbar border border-border">
                <button
                    onClick={() => setResultTab("chats")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${resultTab === "chats" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    <MessageCircle size={18} /> Chats
                </button>
                <button
                    onClick={() => setResultTab("media")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${resultTab === "media" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    <ImageIcon size={18} /> Recovered Media
                </button>
            </div>

            {/* Conteúdo das Abas */}
            <div className="min-h-[300px]">

                {/* 1. ABA CHATS */}
                {resultTab === "chats" && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                            <MessageCircle size={16} /> Recent Conversations (4 Found)
                        </h3>
                        <p className="text-xs text-muted-foreground">Click on a chat to decrypt the history.</p>

                        <div className="space-y-2">
                            {reportConversations.map((convo, i) => (
                                <div
                                    key={i}
                                    onClick={() => setSelectedConvoIndex(i)}
                                    className="flex items-center gap-3 p-3 bg-card hover:bg-secondary border border-border rounded-lg shadow-sm cursor-pointer transition-colors group hover:border-primary/50"
                                >
                                    <div className="w-12 h-12 rounded-full bg-secondary overflow-hidden relative border border-border">
                                        <img src={convo.img || "/placeholder.svg"} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="user" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <p className="font-semibold text-sm truncate text-foreground">{convo.name}</p>
                                            <span className="text-[10px] text-primary font-mono">{convo.time}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                            <CheckCheck size={12} className="text-blue-400" />
                                            {convo.lastMsg}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. ABA MEDIA */}
                {resultTab === "media" && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                            <ImageIcon size={16} /> Recovered Media (9 Photos)
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            {reportMedia.map((img, i) => (
                                <div key={i} className="aspect-square bg-secondary rounded-lg overflow-hidden relative group shadow-sm border border-border">
                                    <img src={img || "/placeholder.svg"} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="media" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>

            {/* Rodapé com Timer */}
            <div className="mt-8 pt-4 border-t border-border flex flex-col items-center justify-center gap-1 text-[11px] uppercase tracking-wide text-primary font-medium opacity-80 text-center">
                <div className="flex items-center gap-2">
                    <Clock size={12} className="animate-pulse" />
                    <span>Next automatic system update in:</span>
                </div>
                <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    {countdownString}
                </span>
                <span className="text-[10px] text-muted-foreground normal-case mt-1">(7-day update cycle)</span>
            </div>

            {/* Popup Chat */}
            {selectedConvoIndex !== null && (
                <ChatPopup
                    onClose={() => setSelectedConvoIndex(null)}
                    profilePhoto={reportConversations[selectedConvoIndex].img}
                    conversationData={reportConversations[selectedConvoIndex].chatData}
                    conversationName={reportConversations[selectedConvoIndex].name}
                />
            )}
        </div>
    )

    return (
        <DashboardLayout activeTab="whatsapp">
            <div className="max-w-2xl mx-auto space-y-6">
                <FeatureCard
                    title={step === 1 ? t?.whatsappScannerTitle : step === 2 ? "Connection in Progress" : "Backup Analysis Complete"}
                    description={step === 1 ? t?.whatsappScannerDesc : step === 2 ? "Establishing secure connection to WhatsApp servers..." : "We found suspicious data in this backup."}
                >
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                </FeatureCard>

                {step === 1 && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-6">
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <MessageCircle className="text-primary" size={24} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground mb-1">Encrypted Analysis</h3>
                                <p className="text-sm text-muted-foreground">
                                    Our algorithm checks for patterns in public connection times, profile changes, and usage statistics to generate probability reports.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
