// Dashboard Page is a Server component
import DashboardLayout from "@/components/dashboard-layout"
import { MessageCircle, Camera, Heart, PlayCircle, Check } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"

export default async function DashboardPage() {
  const supabase = await createClient();
  
  // Performs query on tables ('lessons' and 'courses')
  const { count: lessonsCount } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true });

  const { count: categoriesCount } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true });

  const dynamicLessons = lessonsCount ?? 0;
  const dynamicCategories = categoriesCount ?? 0;

  const modules = [
    {
      id: "whatsapp",
      title: "WhatsApp Scanner",
      description: "Access WhatsApp scanner",
      subText: "Active",
      icon: MessageCircle,
      color: "bg-blue-600",
      buttonText: "Start Scanner →",
      path: "/dashboard/whatsapp"
    },
    {
      id: "instagram",
      title: "Instagram Scanner",
      description: "Access Instagram scanner",
      subText: "Active",
      icon: Camera,
      color: "bg-purple-600",
      buttonText: "Start Scanner →",
      path: "/dashboard/instagram"
    },
    {
      id: "dating",
      title: "Dating Scanner",
      description: "Access Dating scanner",
      subText: "Active",
      icon: Heart,
      color: "bg-orange-500",
      buttonText: "Start Scanner →",
      path: "/dashboard/dating"
    },
    {
      id: "bonus",
      title: "Advanced Spy",
      description: "Introduction to TiSpy",
      subText: "2 lessons",
      icon: PlayCircle,
      color: "bg-green-600",
      buttonText: "Start Lessons →",
      path: "/dashboard/intro"
    }
  ]

  return (
    <DashboardLayout activeTab="home">
      <div className="space-y-6 max-w-7xl mx-auto pb-10">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to the Members Area</h1>
          <p className="text-zinc-300">
            Access complete lessons on advanced digital monitoring with TiSpy
          </p>
        </div>

        {/* Modules Grid (Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.map((mod) => {
            const Icon = mod.icon
            return (
              <div key={mod.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col shadow-sm">
                {/* Colored Card Header */}
                <div className={`${mod.color} h-32 flex items-center justify-center`}>
                  <Icon className="w-12 h-12 text-white" strokeWidth={2} />
                </div>
                
                {/* Card Content */}
                <div className="p-6 flex-1 flex flex-col">
                  <h2 className="text-xl font-bold text-white mb-2">{mod.title}</h2>
                  <p className="text-sm text-zinc-300 mb-4">{mod.description}</p>
                  
                  <div className="mt-auto">
                    <p className="text-xs text-zinc-400 mb-4">{mod.subText}</p>
                    <Link 
                      href={mod.path}
                      className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                    >
                      {mod.buttonText}
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <p className="text-sm text-muted-foreground mb-4">Available Lessons</p>
            <p className="text-3xl font-bold text-white">{dynamicLessons}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <p className="text-sm text-muted-foreground mb-4">Categories</p>
            <p className="text-3xl font-bold text-white">{dynamicCategories}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <p className="text-sm text-muted-foreground mb-4">Premium Access</p>
            <div className="text-white">
              <Check className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-card border border-border rounded-xl p-6 md:p-8 shadow-sm">
          <h2 className="text-xl font-bold text-white mb-4">About the Platform</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-zinc-400">
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                24/7 Unlimited Access
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Official Training
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Priority Support
              </li>
            </ul>
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}

