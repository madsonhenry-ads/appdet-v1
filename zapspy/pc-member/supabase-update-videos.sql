-- Update lessons with real TiSpy YouTube videos

-- Start Here - Introduction to TiSpy
UPDATE lessons 
SET video_url = 'https://www.youtube.com/embed/a0oXhqpFa9Y', 
    description = 'Learn how to install and start using TiSpy. Official video from the TiSpy channel showing the first steps.'
WHERE title = 'Introduction to TiSpy and Scanner Differences' 
AND course_id IN (SELECT id FROM courses WHERE category = 'introduction');

-- Start Here - What is Advanced Spying
UPDATE lessons 
SET video_url = 'https://www.youtube.com/embed/suNDvvB9xx4',
    description = 'Understand how advanced digital spying works with TiSpy. Complete installation tutorial video.'
WHERE title = 'What is Advanced Spying?' 
AND course_id IN (SELECT id FROM courses WHERE category = 'introduction');

-- Installation Tutorial - Preparation and First Steps
UPDATE lessons 
SET video_url = 'https://www.youtube.com/embed/cdcsM9bTJSE',
    description = 'Complete guide to installing TiSpy on Android devices. Follow the steps in the official video.',
    duration_minutes = 12
WHERE title = 'Preparation and First Steps' 
AND course_id IN (SELECT id FROM courses WHERE category = 'installation');

-- Installation Tutorial - Step-by-Step Installation
UPDATE lessons 
SET video_url = 'https://www.youtube.com/embed/E3Os_B2pi4c',
    description = 'Post-installation and special TiSpy configurations. Discover best practices for perfect operation.',
    duration_minutes = 15
WHERE title = 'Step-by-Step Installation' 
AND course_id IN (SELECT id FROM courses WHERE category = 'installation');

-- Installation Tutorial - Practical Tips
UPDATE lessons 
SET video_url = 'https://www.youtube.com/embed/suNDvvB9xx4',
    description = 'Important installation tips: test on your own device first, learn all features before using on another phone.',
    duration_minutes = 10
WHERE title = 'Practical Installation Tips' 
AND course_id IN (SELECT id FROM courses WHERE category = 'installation');

-- Advanced Panel - Overview
UPDATE lessons 
SET video_url = 'https://www.youtube.com/embed/mKYzNNBw6kA',
    description = 'Get to know all the features of the TiSpy control panel. Video showing complete parental control.',
    duration_minutes = 18
WHERE title = 'Control Panel Overview' 
AND course_id IN (SELECT id FROM courses WHERE category = 'advanced');

-- Advanced Panel - Message Monitoring
UPDATE lessons 
SET video_url = 'https://www.youtube.com/embed/a0oXhqpFa9Y',
    description = 'Learn to monitor all messages, private conversations, and groups. Full SMS and messaging app monitoring functionality.',
    duration_minutes = 16
WHERE title = 'Message Monitoring' 
AND course_id IN (SELECT id FROM courses WHERE category = 'advanced');

-- Advanced Panel - Location Tracking
UPDATE lessons 
SET video_url = 'https://www.youtube.com/embed/cdcsM9bTJSE',
    description = 'Track the real-time location of the target device with GPS precision. See location history and geofencing.',
    duration_minutes = 14
WHERE title = 'Location Tracking' 
AND course_id IN (SELECT id FROM courses WHERE category = 'advanced');

-- Advanced Panel - Social Media Monitoring
UPDATE lessons 
SET video_url = 'https://www.youtube.com/embed/E3Os_B2pi4c',
    description = 'Monitor all social media activities, private messages, video calls, and more. Support for WhatsApp, Instagram, Facebook, Telegram, and more.',
    duration_minutes = 17
WHERE title = 'Social Media Monitoring' 
AND course_id IN (SELECT id FROM courses WHERE category = 'advanced');

-- Advanced Panel - Call and Audio Recording
UPDATE lessons 
SET video_url = 'https://www.youtube.com/embed/mKYzNNBw6kA',
    description = 'Record phone calls, ambient audio, and conversations from the target device. Professional audio quality.',
    duration_minutes = 13
WHERE title = 'Call and Audio Recording' 
AND course_id IN (SELECT id FROM courses WHERE category = 'advanced');

-- Advanced Panel - Stealth Mode and Privacy
UPDATE lessons 
SET video_url = 'https://www.youtube.com/embed/suNDvvB9xx4',
    description = 'TiSpy works 100% invisible without leaving traces. Learn how to activate full stealth mode for maximum privacy.',
    duration_minutes = 12
WHERE title = 'Stealth Mode and Privacy' 
AND course_id IN (SELECT id FROM courses WHERE category = 'advanced');

-- Add new lessons to Advanced Panel (already in English now)
INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'App Monitoring', 'See which apps are installed and block the ones you want. Full control over device applications.', 'https://www.youtube.com/embed/mKYzNNBw6kA', 'youtube', 7, 14
FROM courses WHERE category = 'advanced';

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Remote Device Control', 'Remotely control the target device. Perform factory reset, lock the screen, manage files, and more.', 'https://www.youtube.com/embed/a0oXhqpFa9Y', 'youtube', 8, 15
FROM courses WHERE category = 'advanced';

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Camera and Photo Monitoring', 'Access the device camera in real-time. See all captured photos and videos. Complete visual surveillance.', 'https://www.youtube.com/embed/E3Os_B2pi4c', 'youtube', 9, 16
FROM courses WHERE category = 'advanced';

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Browsing History and Cookies', 'See all browsing history, visited sites, and saved cookies. Monitor complete online activity.', 'https://www.youtube.com/embed/cdcsM9bTJSE', 'youtube', 10, 12
FROM courses WHERE category = 'advanced';

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Contacts and Calendar Monitoring', 'Access all contacts, calendars, and events from the device. Know who the person communicates with.', 'https://www.youtube.com/embed/suNDvvB9xx4', 'youtube', 11, 11
FROM courses WHERE category = 'advanced';

INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Real-Time Alerts and Notifications', 'Set up alerts for keywords, specific contacts, or activities. Receive real-time notifications.', 'https://www.youtube.com/embed/mKYzNNBw6kA', 'youtube', 12, 10
FROM courses WHERE category = 'advanced';
