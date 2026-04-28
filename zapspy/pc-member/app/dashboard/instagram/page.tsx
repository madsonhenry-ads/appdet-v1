"use client"

// 👇 Garante que o build não quebre
export const dynamic = "force-dynamic"

import { useState, useRef, useEffect } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import FeatureCard from "@/components/feature-card"
import { useAuth } from "@/lib/auth-context"
import { translations } from "@/lib/translations"
import { Input } from "@/components/ui/input"
import {
    User,
    Instagram,
    CheckCircle,
    Heart,
    MessageCircle,
    MessageSquare,
    Bookmark,
    Loader2,
    X,
    Send,
    Clock
} from "lucide-react"

// ==========================================================
// DADOS MOCKADOS
// ==========================================================
const FEMALE_PROFILES = ["@velvetwhisper_", "@moondustvibe", "@lavenderhaze_x", "@etherealbloom", "@stardustkiss", "@lunarpetalz", "@blossomvoid", "@sereneveil", "@cosmicflutter", "@honeydreams23", "@auroradawn_", "@silkwhirl", "@mysticalglow", "@pearlmist", "@celestiaflow", "@whisperbloom", "@nebulaqueen", "@softlywoven", "@cherryveil_x", "@dreamyorbit", "@lilyecho", "@velvetnova", "@starlitkiss", "@amethystdrift", "@rosedawn_", "@etherealwave", "@moonbloomz", "@crystalhaze", "@serenityglow", "@luminouspetal", "@twilightbloom", "@auroraveil", "@blisswhirl", "@cosmicpearl"]
const FEMALE_IMAGES = ["/images/male/perfil/1.jpg", "/images/male/perfil/2.jpg", "/images/male/perfil/3.jpg", "/images/male/perfil/4.jpg", "/images/male/perfil/5.jpg", "/images/male/perfil/6.jpg", "/images/male/perfil/7.jpg", "/images/male/perfil/8.jpg", "/images/male/perfil/9.jpg", "/images/male/perfil/10.jpg", "/images/male/perfil/11.jpg", "/images/male/perfil/12.jpg", "/images/male/perfil/13.jpg", "/images/male/perfil/14.jpg", "/images/male/perfil/15.jpg", "/images/male/perfil/16.jpg", "/images/male/perfil/17.jpg", "/images/male/perfil/18.jpg", "/images/male/perfil/19.jpg", "/images/male/perfil/20.jpg", "/images/male/perfil/21.jpg", "/images/male/perfil/22.jpg", "/images/male/perfil/23.jpg", "/images/male/perfil/24.jpg", "/images/male/perfil/25.jpg", "/images/male/perfil/26.jpg", "/images/male/perfil/27.jpg", "/images/male/perfil/28.jpg", "/images/male/perfil/29.jpg", "/images/male/perfil/30.jpg", "/images/male/perfil/31.jpg", "/images/male/perfil/32.jpg", "/images/male/perfil/33.jpg", "/images/male/perfil/34.jpg", "/images/male/perfil/35.jpg", "/images/male/perfil/36.jpg", "/images/male/perfil/37.jpg"]
const MALE_PROFILES = ["@shadowdrift_x", "@neonvoid23", "@gritforge", "@lunarbladez", "@cryptorift", "@stormvortex_", "@pixelwraith", "@ironhaze", "@echo_nova", "@dusk_reaver", "@voidpulse88", "@frostbyte_k", "@ravenforge", "@quantumshade", "@blazecore", "@nightforge_x", "@cyberthorn", "@apexdrift", "@ghostwire7", "@solarflarez", "@darknova_", "@titanveil", "@nebulonix", "@inferno_drift", "@zephyr_king", "@oblivionedge", "@vortex_hunter", "@chrome_wraith", "@lunarstrike", "@phantomcore", "@eclipse_rift", "@shadowforge88", "@neonreaver", "@stormveil_x", "@voidking23"]
const MALE_IMAGES = ["/images/female/perfil/1.jpg", "/images/female/perfil/2.jpg", "/images/female/perfil/3.jpg", "/images/female/perfil/4.jpg", "/images/female/perfil/5.jpg", "/images/female/perfil/6.jpg", "/images/female/perfil/7.jpg", "/images/female/perfil/8.jpg", "/images/female/perfil/9.jpg", "/images/female/perfil/10.jpg", "/images/female/perfil/11.jpg", "/images/female/perfil/12.jpg", "/images/female/perfil/13.jpg", "/images/female/perfil/14.jpg", "/images/female/perfil/15.jpg", "/images/female/perfil/16.jpg", "/images/female/perfil/17.jpg", "/images/female/perfil/18.jpg", "/images/female/perfil/19.jpg", "/images/female/perfil/20.jpg", "/images/female/perfil/21.jpg", "/images/female/perfil/22.jpg", "/images/female/perfil/23.jpg", "/images/female/perfil/24.jpg", "/images/female/perfil/25.jpg", "/images/female/perfil/26.jpg", "/images/female/perfil/27.jpg", "/images/female/perfil/28.jpg", "/images/female/perfil/29.jpg", "/images/female/perfil/30.jpg", "/images/female/perfil/31.jpg", "/images/female/perfil/32.jpg", "/images/female/perfil/33.jpg", "/images/female/perfil/34.jpg", "/images/female/perfil/35.jpg"]

const LIKED_BY_MALE_PHOTOS = ["/images/male/liked/male-liked-photo-1.jpg", "/images/male/liked/male-liked-photo-2.jpeg", "/images/male/liked/male-liked-photo-3.jpeg", "/images/male/liked/male-liked-photo-4.jpg", "/images/male/liked/male-liked-photo-5.jpg", "/images/male/liked/male-liked-photo-6.jpg", "/images/male/liked/male-liked-photo-7.jpg", "/images/male/liked/male-liked-photo-8.jpg", "/images/male/liked/male-liked-photo-9.jpg", "/images/male/liked/male-liked-photo-10.jpg", "/images/male/liked/male-liked-photo-11.jpg", "/images/male/liked/male-liked-photo-12.jpg", "/images/male/liked/male-liked-photo-13.jpg"]
const LIKED_BY_MALE_STORIES = ["/images/male/liked/male-liked-story-1.jpg", "/images/male/liked/male-liked-story-2.jpg", "/images/male/liked/male-liked-story-3.jpg", "/images/male/liked/male-liked-story-4.jpg", "/images/male/liked/male-liked-story-5.jpg", "/images/male/liked/male-liked-story-6.jpg", "/images/male/liked/male-liked-story-7.jpg", "/images/male/liked/male-liked-story-8.jpg", "/images/male/liked/male-liked-story-9.jpg", "/images/male/liked/male-liked-story-10.jpg", "/images/male/liked/male-liked-story-11.jpg", "/images/male/liked/male-liked-story-12.jpg", "/images/male/liked/male-liked-story-13.jpg"]
const LIKED_BY_FEMALE_PHOTOS = ["/images/female/liked/female-liked-photo-1.jpg", "/images/female/liked/female-liked-photo-2.jpg", "/images/female/liked/female-liked-photo-3.jpg", "/images/female/liked/female-liked-photo-4.jpg", "/images/female/liked/female-liked-photo-5.jpg", "/images/female/liked/female-liked-photo-6.jpg", "/images/female/liked/female-liked-photo-7.jpg", "/images/female/liked/female-liked-photo-8.jpg", "/images/female/liked/female-liked-photo-9.jpg", "/images/female/liked/female-liked-photo-10.jpg", "/images/female/liked/female-liked-photo-11.jpg", "/images/female/liked/female-liked-photo-12.jpg", "/images/female/liked/female-liked-photo-13.jpg"]
const LIKED_BY_FEMALE_STORIES = ["/images/female/liked/female-liked-story-1.jpg", "/images/female/liked/female-liked-story-2.jpg", "/images/female/liked/female-liked-story-3.jpg", "/images/female/liked/female-liked-story-4.jpg", "/images/female/liked/female-liked-story-5.jpg", "/images/female/liked/female-liked-story-6.jpg", "/images/female/liked/female-liked-story-7.jpg", "/images/female/liked/female-liked-story-8.jpg", "/images/female/liked/female-liked-story-9.jpg", "/images/female/liked/female-liked-story-10.jpg", "/images/female/liked/female-liked-story-11.jpg", "/images/female/liked/female-liked-story-12.jpg", "/images/female/liked/female-liked-story-13.jpg"]

const INTERCEPTED_COMMENTS = ["Wow, you are very hot 🥰", "🫣😏", "I'm getting horny 🥵", "drives me crazy 😈", "Beautiful pic!", "Send me DM", "Miss you", "You're so sexy 😍", "Can't stop staring 🔥", "You turn me on 😉", "Damn, you're irresistible 😜", "Let's get naughty together 💋", "You're making me wild 🐾", "Hot damn! 🌶️", "I want more of you 😘", "You're driving me insane 😈", "Send nudes? 🫣", "You're my fantasy 🥵", "Let's DM now 📩"]

// ==========================================================
// MOCK DE CONVERSAS (DINÂMICAS POR GÊNERO)
// ==========================================================

// Se o alvo for FEMALE (Alvo Mulher falando com Homem)
// Guy = other (esquerda), Woman = me (direita)
// INFIDELITY THEME - Woman secretly chatting with other men
const CHATS_FOR_FEMALE_TARGET = [
    [ // Conversation 1 - Secret Plans
        { sender: "other", text: "Hey... I can't stop thinking about last night 😏" },
        { sender: "me", text: "Shh... you know we can't talk about that here" },
        { sender: "other", text: "When can I see you again? He doesn't have to know..." },
        { sender: "me", text: "Thursday. He'll be at work late 🤫" },
        { sender: "other", text: "Perfect. I'll make it worth your while 😈" },
        { sender: "me", text: "You always do... just be careful, ok?" }
    ],
    [ // Conversation 2 - Guilt & Desire
        { sender: "other", text: "Are you alone? I've been thinking about you all day" },
        { sender: "me", text: "He's in the other room... I shouldn't be texting you" },
        { sender: "other", text: "But you are... that means something 💋" },
        { sender: "me", text: "I know it's wrong but I can't help it" },
        { sender: "other", text: "Meet me tomorrow? Same place as before?" },
        { sender: "me", text: "I'll figure out an excuse. I always do 😔" }
    ],
    [ // Conversation 3 - Weekend Escape
        { sender: "other", text: "So... are we still on for this weekend?" },
        { sender: "me", text: "Yes! I told him I'm visiting my mom 😅" },
        { sender: "other", text: "Smart girl. I booked us a nice hotel room" },
        { sender: "me", text: "You're too good to me... I feel so bad" },
        { sender: "other", text: "Don't feel bad. Feel excited 🔥" },
        { sender: "me", text: "I am... more than you know" }
    ],
    [ // Conversation 4 - Late Night Confessions
        { sender: "other", text: "You up? 👀" },
        { sender: "me", text: "He's asleep next to me... what's up?" },
        { sender: "other", text: "I just needed to hear from you. Miss you" },
        { sender: "me", text: "I miss you too... this is so complicated" },
        { sender: "other", text: "It doesn't have to be. Leave him" },
        { sender: "me", text: "You know I can't... not yet anyway 💔" },
        { sender: "other", text: "I'll wait for you. However long it takes" },
        { sender: "me", text: "Don't make promises you can't keep..." }
    ],
    [ // Conversation 5 - Risky Texts
        { sender: "other", text: "Delete my texts after you read them ok?" },
        { sender: "me", text: "Always do 🤫 He almost saw my phone yesterday" },
        { sender: "other", text: "That's scary... maybe we should cool down" },
        { sender: "me", text: "No! I mean... I don't want to stop this" },
        { sender: "other", text: "Neither do I. You're addicting 😏" },
        { sender: "me", text: "Wednesday? He has poker night" }
    ],
    [ // Conversation 6 - The Close Call
        { sender: "other", text: "Did he find out anything?? You went silent" },
        { sender: "me", text: "Sorry, he came home early. That was close 😰" },
        { sender: "other", text: "We need to be more careful" },
        { sender: "me", text: "I know. But I don't regret anything" },
        { sender: "other", text: "Me neither. You're worth the risk 💕" },
        { sender: "me", text: "Meet me at our spot tomorrow. 3pm" }
    ],
    [ // Conversation 7 - Jealousy
        { sender: "other", text: "Who was that guy in your story?" },
        { sender: "me", text: "Lol jealous? He's just a coworker" },
        { sender: "other", text: "I don't like sharing you... even though I know I shouldn't feel that way" },
        { sender: "me", text: "You're cute when you're jealous 😘" },
        { sender: "other", text: "I just want you all to myself" },
        { sender: "me", text: "You have parts of me no one else does 💋" }
    ],
    [ // Conversation 8 - Hotel Plans
        { sender: "other", text: "I found a new place. Super discreet" },
        { sender: "me", text: "Show me! Is it far?" },
        { sender: "other", text: "20 mins from downtown. They don't ask questions" },
        { sender: "me", text: "Perfect. Book it for Friday 🔥" },
        { sender: "other", text: "Done. I can't wait to see you" },
        { sender: "me", text: "Buy some wine. You know which one I like 🍷" }
    ],
    [ // Conversation 9 - Emotional Affair
        { sender: "other", text: "I think I'm falling for you... is that crazy?" },
        { sender: "me", text: "Not crazy... I feel the same way" },
        { sender: "other", text: "What are we gonna do about this?" },
        { sender: "me", text: "I don't know... but I can't stop 💔" },
        { sender: "other", text: "Neither can I. You're all I think about" },
        { sender: "me", text: "Let's not think about tomorrow. Just us, right now" }
    ],
    [ // Conversation 10 - The Getaway
        { sender: "other", text: "What if we just ran away together? 🌴" },
        { sender: "me", text: "Sometimes I dream about that..." },
        { sender: "other", text: "It doesn't have to be a dream. Say the word" },
        { sender: "me", text: "You'd really leave everything for me?" },
        { sender: "other", text: "In a heartbeat. You're my everything" },
        { sender: "me", text: "Let me think about it... seriously this time" }
    ],
    [ // Conversation 11 - Secret Photos
        { sender: "other", text: "Send me something to get through this boring meeting? 😏" },
        { sender: "me", text: "You're so bad... but ok, give me 5 mins" },
        { sender: "other", text: "That's my girl 🔥" },
        { sender: "me", text: "Only for you. You better delete right after" },
        { sender: "other", text: "Saved them. Just kidding 😂 ...or am I?" },
        { sender: "me", text: "You better be kidding! 😤💕" }
    ],
    [ // Conversation 12 - Making Excuses
        { sender: "other", text: "Can we meet tonight? I really need to see you" },
        { sender: "me", text: "It's risky... he thinks something is going on" },
        { sender: "other", text: "What did you tell him?" },
        { sender: "me", text: "That I'm stressed at work. He bought it" },
        { sender: "other", text: "Good. So tonight? 10pm at our place?" },
        { sender: "me", text: "I'll be there. I can't say no to you ❤️" }
    ]
]

// Se o alvo for MALE (Alvo Homem falando com Mulher)
// Man = me (direita), Woman = other (esquerda)
// INFIDELITY THEME - Man secretly chatting with other women
const CHATS_FOR_MALE_TARGET = [
    [ // Conversation 1 - Secret Meetups
        { sender: "me", text: "Miss you babe... when is she leaving town?" },
        { sender: "other", text: "She's visiting her mom this weekend 💋" },
        { sender: "me", text: "Perfect. My place or yours?" },
        { sender: "other", text: "Yours is safer. I'll tell him I'm with the girls" },
        { sender: "me", text: "Smart. Can't wait to have you all to myself 😈" },
        { sender: "other", text: "Me too... I've been thinking about you nonstop" }
    ],
    [ // Conversation 2 - Work Trip Excuse
        { sender: "me", text: "Told her I have a work trip next week 😏" },
        { sender: "other", text: "Really?? So we finally get a whole night together?" },
        { sender: "me", text: "Two nights actually. Already booked the hotel" },
        { sender: "other", text: "You're bad... I love it 🔥" },
        { sender: "me", text: "Only bad for you. Pack something sexy" },
        { sender: "other", text: "Already know exactly what I'm bringing 💋" }
    ],
    [ // Conversation 3 - The Other Woman
        { sender: "other", text: "Do you ever feel guilty about... us?" },
        { sender: "me", text: "Sometimes. But then I see you and forget everything" },
        { sender: "other", text: "What are we doing? This is so wrong" },
        { sender: "me", text: "Wrong never felt so right 😏" },
        { sender: "other", text: "You always know what to say..." },
        { sender: "me", text: "Thursday night? Same place as last time?" }
    ],
    [ // Conversation 4 - Close Call
        { sender: "me", text: "That was close last night... she almost saw your text" },
        { sender: "other", text: "Omg I was so scared! You need to be more careful" },
        { sender: "me", text: "I know, I know. Changed your name to 'Work Client' 😂" },
        { sender: "other", text: "Smart. I saved you as 'Gym Trainer' lol" },
        { sender: "me", text: "Whatever it takes. I'm not giving you up" },
        { sender: "other", text: "Promise? 💕" },
        { sender: "me", text: "Promise. You're worth the risk" }
    ],
    [ // Conversation 5 - Late Night Desires
        { sender: "other", text: "Are you alone? 👀" },
        { sender: "me", text: "She's asleep. What's up beautiful?" },
        { sender: "other", text: "Can't stop thinking about last time..." },
        { sender: "me", text: "Which part? There were so many good parts 😈" },
        { sender: "other", text: "All of it. When can we do it again?" },
        { sender: "me", text: "This weekend. Make up an excuse" },
        { sender: "other", text: "Already on it. Can hardly wait 🥵" }
    ],
    [ // Conversation 6 - Plans & Lies
        { sender: "me", text: "I told her I'm going to watch the game with the boys" },
        { sender: "other", text: "Perfect cover. I have the whole afternoon free" },
        { sender: "me", text: "Afternoon? That's hours of us time 😏" },
        { sender: "other", text: "That's exactly what I was thinking" },
        { sender: "me", text: "Wear that red thing I like" },
        { sender: "other", text: "Already ahead of you babe 💋" }
    ],
    [ // Conversation 7 - Getting Serious
        { sender: "other", text: "I think I'm falling for you... is that bad?" },
        { sender: "me", text: "I feel the same way. Can't stop thinking about you" },
        { sender: "other", text: "What about her? About your whole life?" },
        { sender: "me", text: "You ARE my life now. She's just... there" },
        { sender: "other", text: "I don't want to be the other woman forever" },
        { sender: "me", text: "You won't be. I just need time to figure this out 💔" }
    ],
    [ // Conversation 8 - Secret Photos
        { sender: "me", text: "Wish I was with you right now instead of this boring dinner 😴" },
        { sender: "other", text: "Poor baby. Want me to make it interesting? 😏" },
        { sender: "me", text: "You wouldn't dare..." },
        { sender: "other", text: "Just sent. Check when you're ALONE 🔥" },
        { sender: "me", text: "You're gonna get me in trouble" },
        { sender: "other", text: "That's the fun part 😈 Delete after viewing" }
    ],
    [ // Conversation 9 - The Double Life
        { sender: "other", text: "How do you do it? Live two lives like this?" },
        { sender: "me", text: "It's not easy. But you make it worth it" },
        { sender: "other", text: "Sometimes I feel guilty about her" },
        { sender: "me", text: "Don't. What she doesn't know won't hurt her" },
        { sender: "other", text: "But it might hurt US eventually" },
        { sender: "me", text: "Let's not think about that. Focus on Thursday 💋" }
    ],
    [ // Conversation 10 - Jealousy
        { sender: "me", text: "Saw you talking to that guy at the coffee shop yesterday 😒" },
        { sender: "other", text: "Wait... you were watching me? That's so hot and creepy lol" },
        { sender: "me", text: "Can't help it. Hate the idea of anyone else with you" },
        { sender: "other", text: "Says the guy who goes home to someone else every night" },
        { sender: "me", text: "That's different. SHE is just an obligation. You're my choice" },
        { sender: "other", text: "Then prove it. Friday. No excuses 🔥" }
    ],
    [ // Conversation 11 - Making It Work
        { sender: "other", text: "My husband is starting to ask questions..." },
        { sender: "me", text: "What kind of questions?" },
        { sender: "other", text: "Why I'm on my phone so much. Why I smile at texts" },
        { sender: "me", text: "Tell him it's work stress. That's what I tell mine" },
        { sender: "other", text: "I hate lying... but I can't give you up" },
        { sender: "me", text: "Then don't. We're careful. We'll be fine ❤️" }
    ],
    [ // Conversation 12 - Late Night Escape
        { sender: "other", text: "Sneak out tonight? I really need to see you" },
        { sender: "me", text: "Risky... she's been clingy lately" },
        { sender: "other", text: "I thought I was more important 😔" },
        { sender: "me", text: "You ARE. Let me think of something..." },
        { sender: "other", text: "Meet me at 11? Our usual spot?" },
        { sender: "me", text: "I'll figure it out. Start driving. I'll be there 😈" }
    ]
]

export default function InstagramScannerPage() {
    const { language } = useAuth()
    const t = translations[language || "en"]

    // --- ESTADOS DO FUNIL ---
    const [step, setStep] = useState(1) // 1: Input, 2: Scanning, 3: Results
    const [instagramHandle, setInstagramHandle] = useState("")
    const [selectedGender, setSelectedGender] = useState<string | null>(null)

    const [profileData, setProfileData] = useState<any>(null)
    const [isLoadingProfile, setIsLoadingProfile] = useState(false)
    const [error, setError] = useState("")

    // Estados de animação do passo 2
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [instagramPosts, setInstagramPosts] = useState<any[]>([])
    const [visiblePosts, setVisiblePosts] = useState<number>(0)

    // Estados do passo 3 (Resultados)
    const [resultTab, setResultTab] = useState<"messages" | "likes" | "comments" | "saved">("messages")
    const [randomizedResults, setRandomizedResults] = useState<Array<{ username: string; image: string; type: "like" | "message"; chatHistory?: any[] }>>([])
    const [interceptedImages, setInterceptedImages] = useState<Array<{ image: string; comment: string }>>([])
    const [savedImages, setSavedImages] = useState<string[]>([])

    // Estado para o Chat Popup
    const [selectedChat, setSelectedChat] = useState<any>(null)

    // Estado para o Cronômetro Individual
    const [countdownString, setCountdownString] = useState("6d 23h 59m")

    // Estado para controle de conversas visíveis baseado no tempo (6h reveal system)
    const [conversationsToShow, setConversationsToShow] = useState(3)

    // Estado para controle de likes visíveis baseado no tempo (10min reveal system)
    const [likesToShow, setLikesToShow] = useState(3)

    const debounceTimer = useRef<NodeJS.Timeout | null>(null)

    // --- LÓGICA DO CRONÔMETRO E REVEAL SYSTEM (User Specific) ---
    useEffect(() => {
        // Apenas roda no cliente
        const STORAGE_KEY = "user_first_scan_access";

        // 1. Verifica se já existe uma data de acesso
        let firstAccess = localStorage.getItem(STORAGE_KEY);

        // 2. Se não existir, salva o momento atual
        if (!firstAccess) {
            firstAccess = Date.now().toString();
            localStorage.setItem(STORAGE_KEY, firstAccess);
        }

        // 3. Define a data alvo (7 dias a partir do primeiro acesso)
        const targetDate = parseInt(firstAccess) + (7 * 24 * 60 * 60 * 1000);

        // 4. Inicia o intervalo de atualização
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

            // 5. Calculate conversations to show based on 6-hour intervals
            // Starts with 3 conversations, adds 1 every 6 hours, max 12
            const hoursSinceStart = (now - parseInt(firstAccess)) / (1000 * 60 * 60);
            const baseConversations = 3;
            const additionalConversations = Math.floor(hoursSinceStart / 6);
            const totalConversations = Math.min(baseConversations + additionalConversations, 12);
            setConversationsToShow(totalConversations);

            // 6. Calculate likes to show based on 5-minute intervals
            // Starts with 10 likes, adds 1 every 5 minutes, max 20
            const minutesSinceStart = (now - parseInt(firstAccess)) / (1000 * 60);
            const baseLikes = 10;
            const additionalLikes = Math.floor(minutesSinceStart / 5);
            const totalLikes = Math.min(baseLikes + additionalLikes, 20);
            setLikesToShow(totalLikes);
        }, 1000);

        // Initial calculation
        const now = Date.now();
        const hoursSinceStart = (now - parseInt(firstAccess)) / (1000 * 60 * 60);
        const baseConversations = 3;
        const additionalConversations = Math.floor(hoursSinceStart / 6);
        const totalConversations = Math.min(baseConversations + additionalConversations, 12);
        setConversationsToShow(totalConversations);

        // Initial likes calculation - starts with 10, +1 every 5 minutes
        const minutesSinceStart = (now - parseInt(firstAccess)) / (1000 * 60);
        const baseLikes = 10;
        const additionalLikes = Math.floor(minutesSinceStart / 5);
        const totalLikes = Math.min(baseLikes + additionalLikes, 20);
        setLikesToShow(totalLikes);

        return () => clearInterval(timerInterval);
    }, []);


    // --- FUNÇÕES AUXILIARES ---
    const sanitizeUsername = (username: string): string => {
        let u = (username || "").trim()
        if (u.startsWith("@")) u = u.slice(1)
        u = u.toLowerCase()
        return u.replace(/[^a-z0-9._]/g, "")
    }

    const shuffleAndPick = (arr: any[], num: number) => {
        return [...arr].sort(() => 0.5 - Math.random()).slice(0, num)
    }

    // --- LÓGICA DE BUSCA DE PERFIL (Passo 1) ---
    const handleInstagramChange = (value: string) => {
        setInstagramHandle(value)
        const sanitizedUser = sanitizeUsername(value)

        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        setError("")
        setProfileData(null)

        if (sanitizedUser.length < 3) {
            setIsLoadingProfile(false)
            return
        }

        setIsLoadingProfile(true)
        debounceTimer.current = setTimeout(async () => {
            try {
                const response = await fetch("/api/instagram/profile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: sanitizedUser }),
                })
                const result = await response.json()

                if (!response.ok || !result.success) {
                    throw new Error(result.error || "Profile not found or private.")
                }
                setProfileData(result.profile)
            } catch (err: any) {
                setError(err.message)
                setProfileData(null)
            } finally {
                setIsLoadingProfile(false)
            }
        }, 1200)
    }

    // --- LÓGICA DE TRANSIÇÃO (Passo 1 -> 2 -> 3) ---
    const handleStartScan = () => {
        if (!profileData || !selectedGender) return

        const fetchPosts = async () => {
            try {
                const cleanUsername = sanitizeUsername(instagramHandle)
                const response = await fetch("/api/instagram/posts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: cleanUsername }),
                })
                if (response.ok) {
                    const data = await response.json()
                    if (data.success && data.posts) {
                        setInstagramPosts(data.posts.slice(0, 9))
                    }
                }
            } catch (error) {
                console.error("Error fetching posts:", error)
            }
        }
        fetchPosts()

        setStep(2)
        setLoadingProgress(0)
        setVisiblePosts(0)

        const interval = setInterval(() => {
            setLoadingProgress((prev) => {
                if (prev >= 95) {
                    clearInterval(interval)
                    return prev
                }
                return prev + Math.random() * 10
            })
        }, 800)

        const postsInterval = setInterval(() => {
            setVisiblePosts((prev) => {
                if (prev >= 9) {
                    clearInterval(postsInterval)
                    return 9
                }
                return prev + 1
            })
        }, 1500)

        setTimeout(() => {
            setLoadingProgress(100)
            setTimeout(() => {
                setStep(3)
            }, 1000)
        }, 15000)
    }

    // --- LÓGICA DO PASSO 3 (Geração de Dados) ---
    useEffect(() => {
        if (step === 3) {
            let profilesToUse = FEMALE_PROFILES
            let imagesToUse = FEMALE_IMAGES
            let likedImagesSource = LIKED_BY_MALE_PHOTOS.concat(LIKED_BY_MALE_STORIES)
            let chatSource = CHATS_FOR_FEMALE_TARGET // Default

            // Se selecionei FEMALE, o alvo é mulher. Os perfis com quem ela fala são HOMENS.
            // Se selecionei MALE, o alvo é homem. Os perfis com quem ele fala são MULHERES.

            if (selectedGender === "female") {
                // Alvo mulher -> Interage com Homens
                profilesToUse = MALE_PROFILES
                imagesToUse = MALE_IMAGES
                likedImagesSource = LIKED_BY_FEMALE_PHOTOS.concat(LIKED_BY_FEMALE_STORIES)
                chatSource = CHATS_FOR_FEMALE_TARGET
            } else {
                // Alvo homem -> Interage com Mulheres (Male e Non-binary cai aqui como default para mulher interagir)
                profilesToUse = FEMALE_PROFILES
                imagesToUse = FEMALE_IMAGES
                likedImagesSource = LIKED_BY_MALE_PHOTOS.concat(LIKED_BY_MALE_STORIES)
                chatSource = CHATS_FOR_MALE_TARGET
            }

            // 1. Generate 12 message conversations + 20 likes = 32 total results
            // Ensure UNIQUE images for each result - no duplicates allowed

            // Create enough unique usernames (duplicate array if needed)
            // We now have 34+ unique profiles, so we can just pick 32 unique ones without duplication
            const allProfiles = [...profilesToUse] // Make a copy
            const shuffledUsernames: string[] = []
            while (shuffledUsernames.length < 32 && allProfiles.length > 0) {
                const randomIndex = Math.floor(Math.random() * allProfiles.length)
                shuffledUsernames.push(allProfiles.splice(randomIndex, 1)[0])
            }

            // Create a pool of unique images - each image used only once
            // If we have 35+ images, we can give each of the 32 results a unique image
            const allImages = [...imagesToUse] // Make a copy
            const shuffledAllImages: string[] = []
            while (allImages.length > 0) {
                const randomIndex = Math.floor(Math.random() * allImages.length)
                shuffledAllImages.push(allImages.splice(randomIndex, 1)[0])
            }

            const results = shuffledUsernames.map((username, index) => {
                const isMessage = index < 12 // First 12 are messages
                return {
                    username,
                    // Each result gets a unique image - direct index access, no modulo
                    image: shuffledAllImages[index] || shuffledAllImages[index % shuffledAllImages.length],
                    type: (isMessage ? "message" : "like") as "like" | "message",
                    // Each message gets a unique chat from the 12 available chats
                    chatHistory: isMessage ? chatSource[index % chatSource.length] : undefined
                }
            })
            setRandomizedResults(results)

            // 2. Comentários
            const randomCommentedImages = shuffleAndPick(likedImagesSource, 4)
            const randomComments = shuffleAndPick(INTERCEPTED_COMMENTS, 4)
            const commentedData = randomCommentedImages.map((img, index) => ({
                image: img,
                comment: randomComments[index % randomComments.length],
            }))
            setInterceptedImages(commentedData)

            // 3. Saved (Quero 6 imagens)
            const randomSaved = shuffleAndPick(likedImagesSource.reverse(), 6)
            setSavedImages(randomSaved)
        }
    }, [step, selectedGender])


    // --- COMPONENTES DE RENDERIZAÇÃO ---

    const ProfileCard = () => {
        if (!profileData) return null
        return (
            <div className="p-4 rounded-lg border border-border bg-card shadow-sm animate-fade-in">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        {profileData.profile_pic_url ? (
                            <img
                                src={profileData.profile_pic_url}
                                alt="profile"
                                className="w-14 h-14 rounded-full object-cover border-2 border-green-500"
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-gray-200" />
                        )}
                        <div>
                            <p className="text-green-600 font-bold text-sm">Instagram Profile</p>
                            <p className="font-bold text-lg text-foreground">@{profileData.username}</p>
                            <p className="text-muted-foreground text-sm">
                                {profileData.media_count} posts • {profileData.follower_count} followers
                            </p>
                        </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                </div>
            </div>
        )
    }

    // --- MODAL DE CHAT ---
    const ChatModal = () => {
        if (!selectedChat) return null

        // Pega o histórico específico desse chat ou usa um array vazio se der erro
        const messages = selectedChat.chatHistory || []

        return (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col h-[500px]">
                    {/* Header */}
                    <div className="bg-secondary/50 border-b border-border p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <img src={selectedChat.image} className="w-10 h-10 rounded-full border border-gray-200" />
                            <div>
                                <p className="font-bold text-sm">{selectedChat.username}</p>
                                <p className="text-xs text-green-600 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Online
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedChat(null)} className="p-2 hover:bg-gray-200 rounded-full transition">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Chat Body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
                        <p className="text-xs text-center text-muted-foreground my-2">Today, 2:30 AM</p>
                        {messages.map((msg: any, i: number) => (
                            <div key={i} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${msg.sender === "me"
                                    ? "bg-primary text-primary-foreground rounded-br-none"
                                    : "bg-card border border-border text-foreground rounded-bl-none shadow-sm"
                                    }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Input */}
                    <div className="p-3 bg-card border-t border-border flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                            <div className="w-4 h-4 border-2 border-current rounded-full" />
                        </div>
                        <input
                            disabled
                            placeholder="Reply..."
                            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none"
                        />
                        <button className="text-blue-500 p-2">
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // PASSO 1: INPUTS
    const renderStep1 = () => (
        <div className="space-y-6">
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">1. Select Target's Gender</h3>
                <div className="grid grid-cols-3 gap-3">
                    {["male", "female", "non-binary"].map((g) => (
                        <button
                            key={g}
                            onClick={() => setSelectedGender(g)}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all hover:scale-105 ${selectedGender === g
                                ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                : "border-border bg-card hover:border-primary/50"
                                }`}
                        >
                            <span className="text-2xl capitalize">{g === "male" ? "👱‍♂️" : g === "female" ? "👱‍♀️" : "👱"}</span>
                            <span className="font-medium text-sm capitalize">{g}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">2. Enter Instagram Username</h3>
                <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                    <Input
                        type="text"
                        placeholder="ex: john_doe"
                        className="pl-12 h-12 text-lg"
                        value={instagramHandle}
                        onChange={(e) => handleInstagramChange(e.target.value)}
                    />
                </div>

                {isLoadingProfile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin" /> Searching profile...
                    </div>
                )}
                {!isLoadingProfile && error && (
                    <p className="text-red-500 text-sm font-medium">{error}</p>
                )}
                {!isLoadingProfile && profileData && <ProfileCard />}
            </div>

            <button
                onClick={handleStartScan}
                disabled={!profileData || !selectedGender || isLoadingProfile}
                className="w-full py-4 text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
            >
                Start Deep Scan 🔍
            </button>
        </div>
    )

    // PASSO 2: LOADING / SCANNING
    const renderStep2 = () => (
        <div className="space-y-6 animate-fade-in relative">
            <h2 className="text-xl font-bold text-center text-primary animate-pulse">Bypassing Security: @{instagramHandle}...</h2>
            <ProfileCard />
            <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-primary">
                    <span className="animate-pulse">DECRYPTING CLOUD BACKUPS...</span>
                    <span>{Math.floor(loadingProgress)}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                    <div
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-full transition-all duration-300 ease-out"
                        style={{ width: `${loadingProgress}%` }}
                    />
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2 opacity-80">
                {instagramPosts.slice(0, visiblePosts).map((post, i) => (
                    <div key={i} className="aspect-square rounded-md overflow-hidden bg-gray-100 animate-fade-in relative">
                        <img
                            src={post.imageUrl || "/placeholder.svg"}
                            className="w-full h-full object-cover"
                            alt="post"
                        />
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                    </div>
                ))}
                {Array.from({ length: Math.max(0, 9 - visiblePosts) }).map((_, i) => (
                    <div key={`p-${i}`} className="aspect-square rounded-md bg-secondary animate-pulse" />
                ))}
            </div>
            <p className="text-center text-sm text-muted-foreground animate-pulse">
                Analyzing interactions, likes, and direct messages...
            </p>
        </div>
    )

    // PASSO 3: RESULTADOS E ABAS
    const renderStep3 = () => {
        // Use time-based reveal system: shows 3 initially, +1 every 6 hours, max 12
        const messages = randomizedResults.filter(r => r.type === "message").slice(0, conversationsToShow);
        // Likes: shows 3 initially, +1 every 10 minutes, max 20
        const likes = randomizedResults.filter(r => r.type === "like").slice(0, likesToShow);

        return (
            <div className="space-y-6 animate-fade-in pb-4">
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-center justify-center gap-2 text-green-700 font-bold text-lg">
                    <CheckCircle className="w-6 h-6" /> Scan Completed Successfully
                </div>

                <ProfileCard />

                {/* --- TABS DE NAVEGAÇÃO --- */}
                <div className="flex p-1 bg-secondary rounded-xl overflow-x-auto no-scrollbar border border-border">
                    <button
                        onClick={() => setResultTab("messages")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${resultTab === "messages" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        <MessageCircle size={18} /> Directs
                    </button>
                    <button
                        onClick={() => setResultTab("likes")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${resultTab === "likes" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        <Heart size={18} /> Likes
                    </button>
                    <button
                        onClick={() => setResultTab("comments")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${resultTab === "comments" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        <MessageSquare size={18} /> Comments
                    </button>
                    <button
                        onClick={() => setResultTab("saved")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${resultTab === "saved" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        <Bookmark size={18} /> Saved
                    </button>
                </div>

                {/* --- CONTEÚDO DAS ABAS --- */}
                <div className="min-h-[300px]">

                    {/* 1. ABA DE MENSAGENS (3 PERFIS + POPUP) */}
                    {resultTab === "messages" && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-gray-800">
                                <MessageCircle className="text-blue-500 w-5 h-5" /> Recent Direct Messages
                            </h3>
                            <p className="text-sm text-gray-500 mb-2">Click on a profile to view intercepted chat.</p>

                            {messages.map((item, i) => (
                                <div
                                    key={i}
                                    onClick={() => setSelectedChat(item)}
                                    className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl shadow-sm hover:shadow-md hover:shadow-primary/20 transition-all cursor-pointer group hover:border-primary/50"
                                >
                                    <img src={item.image} alt="user" className="w-12 h-12 rounded-full object-cover border-2 border-border shadow-sm group-hover:scale-105 transition-transform" />
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center">
                                            <p className="font-bold text-foreground">{item.username}</p>
                                            <span className="text-xs text-primary font-bold bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full animate-pulse">FLAGGED</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            Click to decrypt history... <span className="w-2 h-2 rounded-full bg-primary ml-1 animate-pulse"></span>
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 2. ABA DE LIKES (Time-based reveal with dynamic timestamps) */}
                    {resultTab === "likes" && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-gray-800">
                                <Heart className="text-pink-500 w-5 h-5" /> Liked by Target
                                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full ml-auto animate-pulse">LIVE</span>
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {likes.map((item, i) => {
                                    // Generate dynamic timestamps - newest first, older as you go down
                                    const getTimeAgo = (index: number) => {
                                        const times = [
                                            "Just now",
                                            "2 min ago",
                                            "5 min ago",
                                            "8 min ago",
                                            "12 min ago",
                                            "18 min ago",
                                            "25 min ago",
                                            "34 min ago",
                                            "47 min ago",
                                            "1h ago",
                                            "1h 15m ago",
                                            "1h 42m ago",
                                            "2h ago",
                                            "2h 30m ago",
                                            "3h ago",
                                            "4h ago",
                                            "5h ago",
                                            "6h ago",
                                            "8h ago",
                                            "Yesterday"
                                        ];
                                        return times[index] || "Yesterday";
                                    };

                                    return (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl shadow-sm">
                                            <img src={item.image} alt="user" className="w-10 h-10 rounded-full object-cover" />
                                            <div className="flex-1 text-sm">
                                                <p className="text-foreground">
                                                    Liked <b>{item.username}'s</b> photo
                                                </p>
                                                <p className={`text-xs ${i < 3 ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                                                    {i < 3 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse"></span>}
                                                    {getTimeAgo(i)}
                                                </p>
                                            </div>
                                            <Heart className="text-pink-500 fill-pink-500" size={16} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 3. ABA DE COMENTÁRIOS */}
                    {resultTab === "comments" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                                <MessageSquare className="text-orange-500 w-5 h-5" /> Recent Comments
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {interceptedImages.map((item, index) => (
                                    <div key={index} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                                        <div className="relative h-48 w-full">
                                            <img
                                                src={item.image || "/placeholder.svg"}
                                                alt={`Commented content ${index + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="p-3">
                                            <div className="flex items-start gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs text-muted-foreground mb-1">Commented on this photo:</p>
                                                    <p className="text-sm text-foreground font-medium italic">
                                                        "{item.comment}"
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 4. ABA DE SALVOS (6 IMAGENS) */}
                    {resultTab === "saved" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                                <Bookmark className="text-purple-500 w-5 h-5" /> Saved to Collection
                            </h3>
                            <div className="grid grid-cols-3 gap-3">
                                {savedImages.map((img, index) => (
                                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden shadow-sm group">
                                        <img
                                            src={img}
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                            alt="saved"
                                        />
                                        <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full text-white">
                                            <Bookmark size={12} className="fill-white" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* RODAPÉ COM AVISO DE ATUALIZAÇÃO E TIMER DINÂMICO */}
                <div className="mt-8 pt-4 border-t border-gray-100 flex flex-col items-center justify-center gap-1 text-[11px] uppercase tracking-wide text-green-700 font-medium opacity-80 text-center">
                    <div className="flex items-center gap-2">
                        <Clock size={12} className="animate-pulse" />
                        <span>Next automatic system update in:</span>
                    </div>
                    <span className="text-green-800 font-bold bg-green-100 px-2 py-0.5 rounded">
                        {countdownString}
                    </span>
                    <span className="text-[10px] text-gray-400 normal-case mt-1"></span>
                </div>

                {/* RENDERIZA O MODAL SE TIVER UM CHAT SELECIONADO */}
                {selectedChat && <ChatModal />}
            </div>
        )
    }

    return (
        <DashboardLayout activeTab="instagram">
            <div className="max-w-2xl mx-auto space-y-6">
                <FeatureCard
                    title={step === 1 ? t?.instagramScannerTitle : step === 2 ? "Deep Scanning In Progress" : "Scanner Results"}
                    description={step === 1 ? t?.instagramScannerDesc : step === 2 ? "Please wait while we analyze the target profile." : `Results found for @${instagramHandle}`}
                >
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                </FeatureCard>

                {step === 1 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <div className="flex gap-4">
                            <Instagram className="text-blue-600 flex-shrink-0" size={24} />
                            <div>
                                <h3 className="font-semibold text-foreground mb-1">How it works</h3>
                                <p className="text-sm text-muted-foreground">
                                    Our AI scans public interactions, followers, and activity patterns to build a comprehensive report.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
