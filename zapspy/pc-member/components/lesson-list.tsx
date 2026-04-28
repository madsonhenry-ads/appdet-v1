"use client"

import { useState } from "react"
import { PlayCircle, Clock, ChevronRight } from "lucide-react"

interface Lesson {
  id: string
  title: string
  description: string | null
  video_url: string | null
  video_type: string | null
  duration_minutes: number | null
}

interface LessonListProps {
  lessons: Lesson[]
  categoryTitle: string
}
export default function LessonList({ lessons, categoryTitle }: LessonListProps) {
  // Deduplicate lessons by title to prevent repeated sections if database has duplicates
  const uniqueLessons = lessons.reduce((acc: Lesson[], current) => {
    const x = acc.find(item => item.title === current.title);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, []);

  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(
    uniqueLessons.length > 0 ? uniqueLessons[0] : null
  )

  if (uniqueLessons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <PlayCircle className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-bold text-white">No lessons found</h3>
        <p className="text-zinc-500">Stay tuned! Content is being updated.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Video Player Section */}
      <div className="lg:col-span-2 space-y-6">
        {selectedLesson?.video_url ? (
          <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
            <iframe
              src={selectedLesson.video_url}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            ></iframe>
          </div>
        ) : (
          <div className="aspect-video bg-zinc-900 rounded-2xl flex flex-col items-center justify-center border border-white/5">
            <PlayCircle className="w-12 h-12 text-muted-foreground mb-2" />
            <p className="text-zinc-500">Video not available</p>
          </div>
        )}

        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h2 className="text-2xl font-bold text-white mb-3">
            {selectedLesson?.title}
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            {selectedLesson?.description || "No description provided for this lesson."}
          </p>
        </div>
      </div>

      {/* Course Sidebar */}
      <div className="space-y-4">
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-4">
            {categoryTitle}
          </h3>
          <div className="space-y-2">
            {uniqueLessons.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0)).map((lesson, index) => {
              const isActive = selectedLesson?.id === lesson.id
              return (
                <button
                  key={lesson.id}
                  onClick={() => setSelectedLesson(lesson)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    isActive
                      ? "bg-blue-600/10 border border-blue-500/20 text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isActive ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-500"
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lesson.title}</p>
                    {lesson.duration_minutes && (
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] opacity-60">
                        <Clock size={10} />
                        <span>{lesson.duration_minutes} min</span>
                      </div>
                    )}
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-blue-500" />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
