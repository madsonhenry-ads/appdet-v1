import { createClient } from "@/utils/supabase/server"
import DashboardLayout from "@/components/dashboard-layout"
import LessonList from "@/components/lesson-list"

export default async function BonusPage() {
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from("courses")
    .select("id")
    .eq("category", "bonus")
    .single()

  const { data: lessons } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courses?.id || "")
    .order("order_index", { ascending: true })

  return (
    <DashboardLayout activeTab="bonus">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Exclusive Bonuses</h1>
          <p className="text-zinc-400">Extra tools, VIP content, and exclusive bonuses for our premium members.</p>
        </div>

        <LessonList lessons={lessons || []} categoryTitle="VIP Bonuses" />
      </div>
    </DashboardLayout>
  )
}
