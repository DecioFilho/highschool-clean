# HighSchool

Sistema de gestão escolar para ensino médio construído com React, TypeScript e Supabase.

## Tecnologias

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **State Management**: React Query
- **Routing**: React Router DOM

## Comandos de Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento (porta 8080)
npm run dev

# Build para produção
npm run build

# Build para desenvolvimento
npm run build:dev

# Executar linting
npm run lint

# Visualizar build de produção
npm run preview
```

## Configuração

1. Copie `.env.example` para `.env`
2. Configure as variáveis do Supabase:
   ```
   VITE_SUPABASE_URL=sua_url_aqui
   VITE_SUPABASE_ANON_KEY=sua_chave_aqui
   ```

## Funcionalidades

### Admin
- Gerenciamento completo de usuários (admin, professores, alunos)
- Gestão de turmas e matérias
- Controle de matrículas
- Associação turma-disciplina-professor
- Gestão de notas e frequência
- Gerenciamento de competências de professores

### Professor
- Visualização das suas turmas e matérias
- Lançamento de notas das suas disciplinas
- Registro de frequência das suas aulas
- Visualização de alunos matriculados

### Aluno
- Visualização das suas próprias notas
- Acompanhamento da frequência
- Consulta de turmas e matérias

## Controle de Acesso

O sistema utiliza controle de acesso baseado em roles:
- **Admin**: Acesso total ao sistema
- **Professor**: Acesso às suas turmas e funcionalidades específicas
- **Aluno**: Acesso apenas aos seus dados

## Arquitetura

- Autenticação via Supabase Auth
- Estado gerenciado com React Query
- Componentes reutilizáveis com shadcn/ui
- Validação de formulários com Zod
- Styling com Tailwind CSS