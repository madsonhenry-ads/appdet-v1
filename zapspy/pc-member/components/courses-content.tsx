"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { translations } from "@/lib/translations"
import DashboardLayout from "@/components/dashboard-layout"
import { getCourses, getCoursesByCategory, getLessonsByCourse, getCourseProgress } from "@/lib/supabase-queries"
import type { Course, Lesson } from "@/lib/supabase-queries"
import Link from "next/link"
import { BookOpen, Clock, CheckCircle2, ArrowRight } from "lucide-react"

export default function CoursesContent() {
  const { language, user } = useAuth()
  const searchParams = useSearchParams()
  const category = searchParams.get("category") || "introduction"
  const t = translations[language] || translations["en"]

  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progress, setProgress] = useState<{ [key: string]: number }>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadCourses = async () => {
      setLoading(true)
      const data = await getCoursesByCategory(category)
      setCourses(data)

      if (data.length > 0) {
        setSelectedCourse(data[0])
        const lessonsData = await getLessonsByCourse(data[0].id)
        setLessons(lessonsData)

        // Carregar progresso
        if (user?.id) {
          const progressData = await getCourseProgress(user.id, data[0].id)
          setProgress((prev) => ({
            ...prev,
            [data[0].id]: progressData.percentage,
          }))
        }
      }

      setLoading(false)
    }

    loadCourses()
  }, [category, user?.id])

  const handleSelectCourse = async (course: Course) => {
    setSelectedCourse(course)
    const lessonsData = await getLessonsByCourse(course.id)
    setLessons(lessonsData)

    if (user?.id) {
      const progressData = await getCourseProgress(user.id, course.id)
      setProgress((prev) => ({
        ...prev,
        [course.id]: progressData.percentage,
      }))
    }
  }

  const getCategoryTitle = () => {
    switch (category) {
      case "introduction":
        return t.startHere
      case "installation":
        return t.installationTutorial
      case "advanced":
        return t.advancedPanel
      case "bonus":
        return "Bonus Tools"
      default:
        return "Courses"
    }
  }

  return (
    <DashboardLayout activeTab="courses">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{getCategoryTitle()}</h1>
          <p className="text-gray-400">
            {selectedCourse?.description}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading courses...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No courses available in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar de Cursos */}
            <div className="lg:col-span-1">
              <div className="space-y-2">
                {courses.map((course) => (
                    <button
                    key={course.id}
                    onClick={() => handleSelectCourse(course)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedCourse?.id === course.id
                        ? "border-[#2962FF] bg-[#1a1f3a]"
                        : "border-[#2a3050] hover:border-[#2962FF] bg-[#1a1f3a]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{course.title}</h3>
	                        <p className="text-sm text-[#a0a9c9] mt-1" style={{ fontFamily: 'var(--font-manrope)' }}>
	                          {lessons.length} lessons
	                        </p>
                      </div>
                      {progress[course.id] === 100 && (
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      )}
                    </div>

                    {progress[course.id] !== undefined && progress[course.id] > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-[#2a3050] rounded-full h-1">
                          <div
                            className="bg-[#00E676] h-1 rounded-full"
                            style={{ width: `${progress[course.id]}%` }}
                          />
                        </div>
                        <p className="text-xs text-[#a0a9c9] mt-1" style={{ fontFamily: 'var(--font-manrope)' }}>
	                          {progress[course.id]}% completed
	                        </p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

	            {/* Lessons */}
	            <div className="lg:col-span-2">
	              <div className="space-y-4">
	                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-space-grotesk)' }}>Lessons</h2>
	
	                {lessons.length === 0 ? (
	                  <div className="text-center py-12 bg-[#1a1f3a] rounded-lg">
	                    <p className="text-[#a0a9c9]" style={{ fontFamily: 'var(--font-manrope)' }}>No lessons available.</p>
	                  </div>
                ) : (
                  <div className="space-y-3">
                    {lessons.map((lesson) => (
                      <Link
                        key={lesson.id}
                        href={`/dashboard/courses/${selectedCourse?.id}/${lesson.id}`}
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
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
