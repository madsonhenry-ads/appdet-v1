"use client"

import Link from "next/link"
import { BookOpen, Clock, CheckCircle2, ArrowRight } from "lucide-react"

export default function CoursesContent() {
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "")
  const category = searchParams.get("category") || "introduction"

  const t = {
    startHere: "Start Here",
    installationTutorial: "Installation Tutorial",
    advancedPanel: "Advanced Panel",
    bonus: "Bonus Tools",
    courses: "Courses"
  }

  const courses = [
    {
      id: "introduction",
      title: "Welcome to TiSpy",
      description: "Learn the basics of TiSpy monitoring platform",
      lessons: 5,
      icon: "👋"
    },
    {
      id: "installation",
      title: "Installation Guide",
      description: "Step-by-step setup instructions",
      lessons: 3,
      icon: "🚀"
    },
    {
      id: "advanced",
      title: "Advanced Features",
      description: "Master powerful monitoring tools",
      lessons: 8,
      icon: "⚡"
    },
    {
      id: "bonus",
      title: "Bonus Tools",
      description: "Exclusive additional utilities",
      lessons: 2,
      icon: "🎁"
    }
  ]

  const lessons = [
    {
      id: "1",
      title: "Introduction to TiSpy",
      description: "Understand the platform capabilities and limitations",
      duration_minutes: 15
    },
    {
      id: "2",
      title: "Basic Setup",
      description: "Initial configuration and account creation",
      duration_minutes: 20
    },
    {
      id: "3",
      title: "Advanced Dashboard",
      description: "Navigate and use advanced monitoring features",
      duration_minutes: 25
    }
  ]

  const getCategoryTitle = () => {
    switch (category) {
      case "introduction":
        return t.startHere
      case "installation":
        return t.installationTutorial
      case "advanced":
        return t.advancedPanel
      case "bonus":
        return t.bonus
      default:
        return t.courses
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          {getCategoryTitle()}
        </h1>
        <p className="text-gray-400">
          Free access to all courses and training materials
        </p>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div
            key={course.id}
            className="border border-[#2a3050] rounded-lg hover:border-[#2962FF] hover:bg-[#1a1f3a]/80 transition-all p-6"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="text-4xl">{course.icon}</div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {course.title}
            </h3>
            <p className="text-sm text-[#a0a9c9] mb-4">
              {course.description}
            </p>

            <div className="flex items-center gap-2 text-sm text-[#6b7280] mb-4">
              <BookOpen className="w-4 h-4" />
              <span>{course.lessons} lessons</span>
            </div>

            <div className="border-t border-[#2a3050] pt-4 mt-auto">
              <Link
                href={`/dashboard/courses/${course.id}`}
                className="inline-flex items-center gap-2 text-[#2962FF] hover:text-[#3d7cff] font-medium"
              >
                View Courses
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Current Course Lessons */}
      <div className="border border-[#2a3050] rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Available Lessons
          </h2>
        </div>

        {lessons.length === 0 ? (
          <div className="text-center py-12 bg-[#1a1f3a] rounded-lg">
            <p className="text-[#a0a9c9]" style={{ fontFamily: 'var(--font-manrope)' }}>No lessons available.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/dashboard/lessons/${lesson.id}`}
                className="block p-4 border border-[#2a3050] rounded-lg hover:border-[#2962FF] hover:bg-[#1a1f3a]/80 transition-all group bg-[#1a1f3a]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white group-hover:text-[#2962FF]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                      {lesson.title}
                    </h3>
                    <p className="text-sm text-[#a0a9c9] mt-1 line-clamp-2" style={{ fontFamily: 'var(--font-manrope)' }}>
                      {lesson.description}
                    </p>

                    <div className="flex items-center gap-4 mt-3 text-xs text-[#6b7280]" style={{ fontFamily: 'var(--font-manrope)' }}>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {lesson.duration_minutes} min
                      </div>
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        Video
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-5 h-5 text-[#6b7280] group-hover:text-[#2962FF] flex-shrink-0 mt-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
