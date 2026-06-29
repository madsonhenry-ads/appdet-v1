import DashboardLayout from "@/components/dashboard-layout"
import LessonList from "@/components/lesson-list"

const lessons = [
  {
    id: "1",
    title: "Introduction to AppDetect and Scanner Differences",
    description: "Learn the differences between the scanner and AppDetect, and how AppDetect offers 100% mobile access.",
    video_url: "6a4285c4d846aeb492a38dd4",
    video_type: "converteai",
    duration_minutes: 10,
  },
]

export default function IntroPage() {
  return (
    <DashboardLayout activeTab="intro">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Start Here</h1>
          <p className="text-zinc-400">Welcome to your professional espionage training. Start with these essential steps.</p>
        </div>

        <LessonList lessons={lessons} categoryTitle="Introduction" />
      </div>
    </DashboardLayout>
  )
}