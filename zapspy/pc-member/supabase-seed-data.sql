-- Initial Data - Courses
INSERT INTO courses (title, description, category, order_index) VALUES
('Start Here', 'Learn the differences between the scanner and TiSpy, and how TiSpy offers 100% mobile access', 'introduction', 1),
('Installation Tutorial', 'Step-by-step guide to installing TiSpy on the target phone with practical tips', 'installation', 2),
('Advanced Panel', 'Master all the features of the TiSpy monitoring panel', 'advanced', 3),
('Bonus Tools', 'Access to social media scanners as additional resources', 'bonus', 4);

-- Initial Data - Lessons for "Start Here"
INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Introduction to TiSpy and Scanner Differences', 'In this lesson you will learn the limitations of the traditional scanner and how TiSpy offers a complete solution with 100% access to the target phone.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 1, 15
FROM courses WHERE category = 'introduction'
LIMIT 1;

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'What is Advanced Spying?', 'Understand how advanced digital spying works and why TiSpy is the most reliable solution on the market.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 2, 12
FROM courses WHERE category = 'introduction'
LIMIT 1;

-- Initial Data - Lessons for "Installation Tutorial"
INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Preparation and First Steps', 'Learn how to prepare the phone and the first steps to install TiSpy safely.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 1, 18
FROM courses WHERE category = 'installation'
LIMIT 1;

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Step-by-Step Installation', 'Detailed guide with screenshots showing each step of the TiSpy installation on the target phone.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 2, 20
FROM courses WHERE category = 'installation'
LIMIT 1;

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Practical Installation Tips', 'Important tips: install first on your own phone to learn, or offer a new phone as a gift.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 3, 10
FROM courses WHERE category = 'installation'
LIMIT 1;

-- Initial Data - Lessons for "Advanced Panel"
INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Control Panel Overview', 'Get to know the complete interface of the TiSpy monitoring panel and its main features.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 1, 15
FROM courses WHERE category = 'advanced'
LIMIT 1;

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Message Monitoring', 'Learn how to monitor all messages, private conversations, and groups on the target phone.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 2, 18
FROM courses WHERE category = 'advanced'
LIMIT 1;

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Location Tracking', 'Learn how to track the real-time location of the target phone with GPS precision.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 3, 16
FROM courses WHERE category = 'advanced'
LIMIT 1;

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Social Media Monitoring', 'Monitor all social media activities, private messages, and video calls.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 4, 17
FROM courses WHERE category = 'advanced'
LIMIT 1;

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Call and Audio Recording', 'Learn how to record calls, ambient audio, and conversations from the target phone.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 5, 14
FROM courses WHERE category = 'advanced'
LIMIT 1;

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Stealth Mode and Privacy', 'Understand how TiSpy works in 100% invisible stealth mode without leaving traces.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 6, 13
FROM courses WHERE category = 'advanced'
LIMIT 1;

-- Initial Data - Lessons for "Bonus Tools"
INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Instagram Scanner', 'Learn how to use the Instagram scanner to analyze public profiles and engagement data.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 1, 10
FROM courses WHERE category = 'bonus'
LIMIT 1;

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'WhatsApp Scanner', 'Learn how to use the WhatsApp scanner to obtain public profile information.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 2, 8
FROM courses WHERE category = 'bonus'
LIMIT 1;

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Dating Apps Scanner', 'Discover how to use the scanner to analyze profiles on dating applications.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 3, 9
FROM courses WHERE category = 'bonus'
LIMIT 1;
