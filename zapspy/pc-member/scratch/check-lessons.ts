
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDuplicates() {
  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("*")
  
  if (error) {
    console.error("Error fetching lessons:", error)
    return
  }

  console.log(`Total lessons: ${lessons.length}`)
  
  const counts: Record<string, number> = {}
  lessons.forEach(l => {
    const key = `${l.title}|${l.course_id}`
    counts[key] = (counts[key] || 0) + 1
  })

  const duplicates = Object.entries(counts).filter(([_, count]) => count > 1)
  
  if (duplicates.length > 0) {
    console.log("Found duplicate lessons (title + course_id):")
    duplicates.forEach(([key, count]) => {
      console.log(`- ${key}: ${count} times`)
    })
  } else {
    console.log("No duplicates found by title + course_id.")
  }
}

checkDuplicates()
