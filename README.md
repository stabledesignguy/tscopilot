# TScopilot

AI-powered technical support chat application with RAG (Retrieval-Augmented Generation) capabilities.

## Features

- Multi-LLM support (Claude, ChatGPT, Gemini)
- RAG-based document search for accurate answers
- Product-specific knowledge bases
- Admin dashboard for product and document management
- Real-time chat with streaming responses
- Conversation history and export

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL + pgvector)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **LLMs**: Claude (Anthropic), ChatGPT (OpenAI), Gemini (Google)

## Prerequisites

- Node.js 18+
- Supabase account
- API keys for at least one LLM provider (Anthropic, OpenAI, or Google AI)

## Setup

### 1. Clone and Install

```bash
cd tscopilot
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `supabase/schema.sql`
3. Copy your project URL and keys from Settings > API

### 3. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

At least one LLM API key:
- `ANTHROPIC_API_KEY` - For Claude
- `OPENAI_API_KEY` - For ChatGPT and embeddings
- `GOOGLE_AI_API_KEY` - For Gemini

**Note**: OpenAI API key is required for document embeddings, even if you use other LLMs for chat.

### 4. Create Admin User

1. Start the development server: `npm run dev`
2. Sign up with your email
3. In Supabase SQL Editor, run:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
   ```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

### For Users

1. Log in to the application
2. Select a product from the sidebar
3. Ask questions about the product in the chat
4. Export conversations as needed

### For Admins

1. Log in and click "Admin" in the header
2. **Products**: Create, edit, or delete products
3. **Documents**: Upload documentation files (PDF, DOCX, TXT, MD) for each product
4. Documents are automatically processed and indexed for RAG search

## Project Structure

```
tscopilot/
├── app/                    # Next.js app router pages
│   ├── (auth)/            # Authentication pages
│   ├── (main)/            # Main application pages
│   ├── admin/             # Admin dashboard pages
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── chat/             # Chat-related components
│   ├── products/         # Product-related components
│   └── admin/            # Admin-specific components
├── lib/                   # Utility libraries
│   ├── supabase/         # Supabase client configuration
│   ├── llm/              # LLM service layer
│   └── rag/              # RAG pipeline (parser, chunker, embeddings, retriever)
├── types/                 # TypeScript type definitions
└── supabase/             # Database schema
```

## API Endpoints

- `POST /api/chat` - Send chat message, receive streaming response
- `GET /api/products` - List all products
- `POST /api/products` - Create product (admin)
- `GET /api/conversations` - List user conversations
- `POST /api/documents` - Upload document (admin)
- `POST /api/documents/process` - Process document for RAG

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

## License

MIT
