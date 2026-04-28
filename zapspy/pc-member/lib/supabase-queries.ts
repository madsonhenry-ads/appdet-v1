import { createClient } from "@/utils/supabase/client"

export interface Course {
  id: string
  title: string
  description: string
  category: string
  order_index: number
  created_at: string
  updated_at: string
}

export interface Lesson {
  id: string
  course_id: string
  title: string
  description: string
  video_url: string
  video_type: string
  order_index: number
  duration_minutes: number
  created_at: string
  updated_at: string
}

export interface UserProgress {
  id: string
  user_id: string
  lesson_id: string
  completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

// Queries para Cursos
export async function getCourses(): Promise<Course[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("order_index", { ascending: true })

  if (error) {
    console.error("Erro ao buscar cursos:", error)
    return []
  }

  return data || []
}

export async function getCoursesByCategory(category: string): Promise<Course[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("category", category)
    .order("order_index", { ascending: true })

  if (error) {
    console.error("Erro ao buscar cursos por categoria:", error)
    return []
  }

  return data || []
}

export async function getCourseById(courseId: string): Promise<Course | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single()

  if (error) {
    console.error("Erro ao buscar curso:", error)
    return null
  }

  return data
}

// Queries para Aulas
export async function getLessonsByCourse(courseId: string): Promise<Lesson[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true })

  if (error) {
    console.error("Erro ao buscar aulas:", error)
    return []
  }

  return data || []
}

export async function getLessonById(lessonId: string): Promise<Lesson | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .single()

  if (error) {
    console.error("Erro ao buscar aula:", error)
    return null
  }

  return data
}

// Queries para Progresso
export async function getUserProgress(userId: string, courseId: string): Promise<UserProgress[]> {
  const supabase = createClient()

  // Primeiro, buscar todas as aulas do curso
  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", courseId)

  if (lessonsError) {
    console.error("Erro ao buscar aulas:", lessonsError)
    return []
  }

  if (!lessons || lessons.length === 0) {
    return []
  }

  const lessonIds = lessons.map((l) => l.id)

  // Depois, buscar o progresso do usuário para essas aulas
  const { data, error } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", userId)
    .in("lesson_id", lessonIds)

  if (error) {
    console.error("Erro ao buscar progresso:", error)
    return []
  }

  return data || []
}

export async function markLessonComplete(userId: string, lessonId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase.from("user_progress").upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      completed: true,
      completed_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,lesson_id",
    }
  )

  if (error) {
    console.error("Erro ao marcar aula como concluída:", error)
    return false
  }

  return true
}

export async function getLessonProgress(userId: string, lessonId: string): Promise<UserProgress | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .single()

  if (error) {
    // Não é erro se não encontrar (ainda não iniciou a aula)
    return null
  }

  return data
}

export async function getCourseProgress(userId: string, courseId: string): Promise<{
  total: number
  completed: number
  percentage: number
}> {
  const supabase = createClient()

  // Buscar total de aulas do curso
  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", courseId)

  if (lessonsError || !lessons) {
    return { total: 0, completed: 0, percentage: 0 }
  }

  const total = lessons.length

  if (total === 0) {
    return { total: 0, completed: 0, percentage: 0 }
  }

  const lessonIds = lessons.map((l) => l.id)

  // Buscar aulas completadas
  const { data: progress, error: progressError } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", userId)
    .in("lesson_id", lessonIds)
    .eq("completed", true)

  if (progressError || !progress) {
    return { total, completed: 0, percentage: 0 }
  }

  const completed = progress.length
  const percentage = Math.round((completed / total) * 100)

  return { total, completed, percentage }
}
