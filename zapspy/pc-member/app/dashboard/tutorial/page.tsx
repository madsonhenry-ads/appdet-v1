import DashboardLayout from "@/components/dashboard-layout"
import LessonList from "@/components/lesson-list"

const lessons = [
  {
    id: "1",
    title: "Step 1 - Disable Google Play Protect",
    description: "First step to install AppDetect: learn how to disable Google Play Protect to allow the installation.",
    video_url: "6a4278f3b217e118b8e103f0",
    video_type: "converteai",
    duration_minutes: 3,
  },
  {
    id: "2",
    title: "Step 2 - Disable Samsung Anti-virus",
    description: "Learn how to disable Samsung Anti-virus to proceed with the AppDetect installation.",
    video_url: "6a4278f141e08577fc367542",
    video_type: "converteai",
    duration_minutes: 3,
  },
  {
    id: "3",
    title: "Step 3 - Disable Google Play Protect",
    description: "Double-check and ensure Google Play Protect is fully disabled for the installation.",
    video_url: "6a4278e9d846aeb492a3836e",
    video_type: "converteai",
    duration_minutes: 3,
  },
  {
    id: "4",
    title: "Step 4 - Grant The Required Permission",
    description: "Grant all necessary permissions for AppDetect to work correctly on the target device.",
    video_url: "6a4278eb76550db92c2b44b3",
    video_type: "converteai",
    duration_minutes: 3,
  },
  {
    id: "5",
    title: "Step 5 - Register Or Login Account",
    description: "Final step: register or log in to your AppDetect account to start monitoring.",
    video_url: "6a4278ee2f7698b129ffc178",
    video_type: "converteai",
    duration_minutes: 3,
  },
]

export default function TutorialPage() {
  return (
    <DashboardLayout activeTab="tutorial">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Installation Tutorial</h1>
          <p className="text-zinc-400">Complete step-by-step guide to installing the AppDetect monitoring software.</p>
        </div>

        <LessonList lessons={lessons} categoryTitle="Installation Guide" />
      </div>
    </DashboardLayout>
  )
}