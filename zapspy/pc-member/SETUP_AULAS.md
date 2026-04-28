# Integração de Aulas em Vídeo - Scanner Pro

## 📋 Resumo da Integração

Este projeto foi atualizado com um sistema completo de aulas em vídeo sobre TiSpy, mantendo o scanner funcional.

### ✨ Novas Funcionalidades

1. **4 Menus de Aulas:**
   - Comece Aqui (Introdução ao TiSpy)
   - Tutorial de Instalação (Guia passo a passo)
   - Painel Avançado (Funcionalidades avançadas)
   - Bónus (Ferramentas de scanner)

2. **Player de Vídeo:**
   - Suporte a YouTube, Vimeo e vídeos diretos
   - Marcação automática de aulas assistidas
   - Sistema de progresso

3. **Sistema de Progresso:**
   - Rastreamento de aulas concluídas por usuário
   - Barra de progresso por curso
   - Dados armazenados no Supabase

## 🚀 Instalação

### 1. Executar Scripts SQL no Supabase

1. Abra seu projeto Supabase
2. Vá para **SQL Editor** → **New Query**
3. Cole o conteúdo de `supabase-migration.sql` e execute
4. Depois cole `supabase-seed-data.sql` e execute

Isso criará as tabelas:
- `courses` - Cursos disponíveis
- `lessons` - Aulas de cada curso
- `user_progress` - Progresso do usuário

### 2. Verificar Variáveis de Ambiente

Certifique-se que seu `.env.local` tem:
```env
NEXT_PUBLIC_SUPABASE_URL=seu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave
```

### 3. Testar as Novas Rotas

Após fazer login, acesse:

- **Comece Aqui:** `/dashboard/courses?category=introduction`
- **Tutorial de Instalação:** `/dashboard/courses?category=installation`
- **Painel Avançado:** `/dashboard/courses?category=advanced`
- **Bónus:** `/dashboard/courses?category=bonus`

## 📁 Arquivos Criados/Modificados

### Novos Arquivos:
- `supabase-migration.sql` - Schema do banco de dados
- `supabase-seed-data.sql` - Dados iniciais
- `lib/supabase-queries.ts` - Helpers para queries
- `components/video-player.tsx` - Componente de player
- `app/dashboard/courses/page.tsx` - Página de cursos
- `app/dashboard/courses/[courseId]/[lessonId]/page.tsx` - Página de aula

### Modificados:
- `components/sidebar.tsx` - Adicionados novos menus de aulas

## 🎯 Como Funciona

### Fluxo de Aula:

1. Usuário clica em um menu de aula na sidebar
2. Vê a lista de cursos disponíveis
3. Clica em uma aula para abrir o player
4. Assiste o vídeo (YouTube, Vimeo ou direto)
5. Marca como assistido clicando no botão
6. Progresso é salvo no Supabase

### Estrutura de Dados:

```
Courses (Cursos)
├── introduction (Comece Aqui)
├── installation (Tutorial de Instalação)
├── advanced (Painel Avançado)
└── bonus (Ferramentas Bónus)

Lessons (Aulas)
├── Cada curso tem múltiplas aulas
├── Cada aula tem vídeo URL e tipo

User Progress (Progresso)
├── Rastreia qual usuário completou qual aula
├── Armazena data de conclusão
└── Calcula percentual de progresso
```

## 🔧 Customizações

### Adicionar Novas Aulas:

1. Abra o Supabase SQL Editor
2. Execute:
```sql
INSERT INTO lessons (course_id, title, description, video_url, video_type, order_index, duration_minutes)
SELECT id, 'Título da Aula', 'Descrição', 'https://youtube.com/embed/VIDEO_ID', 'youtube', 1, 15
FROM courses WHERE category = 'advanced'
LIMIT 1;
```

### Mudar URLs de Vídeo:

Edite `supabase-seed-data.sql` e atualize os `video_url` antes de executar.

### Adicionar Novo Curso:

```sql
INSERT INTO courses (title, description, category, order_index) 
VALUES ('Novo Curso', 'Descrição', 'nova_categoria', 5);
```

## 📊 Queries Disponíveis

Em `lib/supabase-queries.ts`:

- `getCourses()` - Listar todos os cursos
- `getCoursesByCategory(category)` - Cursos por categoria
- `getLessonsByCourse(courseId)` - Aulas de um curso
- `markLessonComplete(userId, lessonId)` - Marcar aula como concluída
- `getCourseProgress(userId, courseId)` - Progresso do usuário

## ⚠️ Notas Importantes

1. **Scanner Original:** Todas as funcionalidades de scanner (Instagram, WhatsApp, Dating) continuam funcionando normalmente
2. **Autenticação:** Usa a mesma autenticação Supabase existente
3. **Dados:** Aulas e progresso são armazenados no Supabase
4. **Vídeos:** URLs de vídeo podem ser atualizadas a qualquer momento

## 🐛 Troubleshooting

### Aulas não aparecem:
- Verifique se executou os scripts SQL
- Confirme que o Supabase está configurado corretamente

### Vídeos não carregam:
- Verifique se a URL do YouTube está correta
- Certifique-se que é uma URL de embed (youtube.com/embed/...)

### Progresso não salva:
- Confirme que o usuário está autenticado
- Verifique as permissões do Supabase na tabela `user_progress`

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- Documentação do Supabase: https://supabase.com/docs
- Repositório: https://github.com/madsonpapito/pc-infidelity
