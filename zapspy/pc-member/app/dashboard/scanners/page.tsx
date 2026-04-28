import { createClient } from "@/utils/supabase/server"
import DashboardLayout from "@/components/dashboard-layout"
import LessonList from "@/components/lesson-list"

export default async function ScannersPage() {
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from("courses")
    .select("id")
    .eq("category", "advanced")
    .single()

  const { data: lessons } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courses?.id || "")
    .order("order_index", { ascending: true })

  return (
    <DashboardLayout activeTab="advanced">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Advanced Panel</h1>
          <p className="text-zinc-400">Master the professional control panel and all its advanced monitoring tools.</p>
        </div>

        <LessonList lessons={lessons || []} categoryTitle="Advanced Espionage" />
      </div>
    </DashboardLayout>
  )
}
