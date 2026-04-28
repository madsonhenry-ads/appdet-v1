-- Translate Courses
UPDATE courses SET 
  title = 'Start Here', 
  description = 'Learn the differences between the scanner and TiSpy, and how TiSpy offers 100% mobile access' 
WHERE category = 'introduction';

UPDATE courses SET 
  title = 'Installation Tutorial', 
  description = 'Step-by-step guide to installing TiSpy on the target phone with practical tips' 
WHERE category = 'installation';

UPDATE courses SET 
  title = 'Advanced Panel', 
  description = 'Master all the features of the TiSpy monitoring panel' 
WHERE category = 'advanced';

UPDATE courses SET 
  title = 'Bonus Tools', 
  description = 'Access to social media scanners as additional resources' 
WHERE category = 'bonus';

-- Translate Lessons for "Start Here"
UPDATE lessons SET 
  title = 'Introduction to TiSpy and Scanner Differences', 
  description = 'Learn how to install and start using TiSpy. Official video from the TiSpy channel showing the first steps.' 
WHERE title = 'Introdução ao TiSpy e Diferenças com o Scanner';

UPDATE lessons SET 
  title = 'What is Advanced Spying?', 
  description = 'Understand how advanced digital spying works with TiSpy. Complete installation tutorial video.' 
WHERE title = 'O Que é Espionagem Avançada?';

-- Translate Lessons for "Installation Tutorial"
UPDATE lessons SET 
  title = 'Preparation and First Steps', 
  description = 'Complete guide to installing TiSpy on Android devices. Follow the steps in the official video.',
  duration_minutes = 12
WHERE title = 'Preparação e Primeiros Passos';

UPDATE lessons SET 
  title = 'Step-by-Step Installation', 
  description = 'Post-installation and special TiSpy configurations. Discover best practices for perfect operation.',
  duration_minutes = 15
WHERE title = 'Instalação Passo a Passo';

UPDATE lessons SET 
  title = 'Practical Installation Tips', 
  description = 'Important installation tips: test on your own device first, learn all features before using on another phone.',
  duration_minutes = 10
WHERE title = 'Dicas Práticas de Instalação';

-- Translate Lessons for "Advanced Panel"
UPDATE lessons SET 
  title = 'Control Panel Overview', 
  description = 'Get to know all the features of the TiSpy control panel. Video showing complete parental control.',
  duration_minutes = 18
WHERE title = 'Visão Geral do Painel de Controle';

UPDATE lessons SET 
  title = 'Message Monitoring', 
  description = 'Learn to monitor all messages, private conversations, and groups. Full SMS and messaging app monitoring functionality.',
  duration_minutes = 16
WHERE title = 'Monitoramento de Mensagens';

UPDATE lessons SET 
  title = 'Location Tracking', 
  description = 'Track the real-time location of the target device with GPS precision. See location history and geofencing.',
  duration_minutes = 14
WHERE title = 'Rastreamento de Localização';

UPDATE lessons SET 
  title = 'Social Media Monitoring', 
  description = 'Monitor all social media activities, private messages, video calls, and more. Support for WhatsApp, Instagram, Facebook, Telegram, and more.',
  duration_minutes = 17
WHERE title = 'Monitoramento de Redes Sociais';

UPDATE lessons SET 
  title = 'Call and Audio Recording', 
  description = 'Record phone calls, ambient audio, and conversations from the target device. Professional audio quality.',
  duration_minutes = 13
WHERE title = 'Gravação de Chamadas e Áudio';

UPDATE lessons SET 
  title = 'Stealth Mode and Privacy', 
  description = 'TiSpy works 100% invisible without leaving traces. Learn how to activate full stealth mode for maximum privacy.',
  duration_minutes = 12
WHERE title = 'Modo Stealth e Privacidade';

-- New Advanced Panel Lessons
UPDATE lessons SET 
  title = 'App Monitoring', 
  description = 'See which apps are installed and block the ones you want. Full control over device applications.' 
WHERE title = 'Monitoramento de Aplicativos';

UPDATE lessons SET 
  title = 'Remote Device Control', 
  description = 'Remotely control the target device. Perform factory reset, lock the screen, manage files, and more.' 
WHERE title = 'Controle Remoto do Dispositivo';

UPDATE lessons SET 
  title = 'Camera and Photo Monitoring', 
  description = 'Access the device camera in real-time. See all captured photos and videos. Complete visual surveillance.' 
WHERE title = 'Monitoramento de Câmera e Fotos';

UPDATE lessons SET 
  title = 'Browsing History and Cookies', 
  description = 'See all browsing history, visited sites, and saved cookies. Monitor complete online activity.' 
WHERE title = 'Histórico de Navegação e Cookies';

UPDATE lessons SET 
  title = 'Contacts and Calendar Monitoring', 
  description = 'Access all contacts, calendars, and events from the device. Know who the person communicates with.' 
WHERE title = 'Monitoramento de Contatos e Calendário';

UPDATE lessons SET 
  title = 'Real-Time Alerts and Notifications', 
  description = 'Set up alerts for keywords, specific contacts, or activities. Receive real-time notifications.' 
WHERE title = 'Alertas e Notificações em Tempo Real';

-- Translate Lessons for "Bonus Tools"
UPDATE lessons SET 
  title = 'Instagram Scanner', 
  description = 'Learn how to use the Instagram scanner to analyze public profiles and engagement data.' 
WHERE title = 'Scanner de Instagram';

UPDATE lessons SET 
  title = 'WhatsApp Scanner', 
  description = 'Learn how to use the WhatsApp scanner to obtain public profile information.' 
WHERE title = 'Scanner de WhatsApp';

UPDATE lessons SET 
  title = 'Dating Apps Scanner', 
  description = 'Discover how to use the scanner to analyze profiles on dating applications.' 
WHERE title = 'Scanner de Apps de Encontros';
