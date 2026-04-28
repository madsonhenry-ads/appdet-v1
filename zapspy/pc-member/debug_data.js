const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    console.log('--- Fetching Courses ---');
    const { data: courses, error: coursesError } = await supabase.from('courses').select('*');
    if (coursesError) console.error('Courses Error:', coursesError);
    else console.log(JSON.stringify(courses, null, 2));

    console.log('\n--- Fetching Lessons ---');
    const { data: lessons, error: lessonsError } = await supabase.from('lessons').select('*');
    if (lessonsError) console.error('Lessons Error:', lessonsError);
    else console.log(JSON.stringify(lessons, null, 2));
  } catch (err) {
    console.error('Execution Error:', err);
  }
}

check();
