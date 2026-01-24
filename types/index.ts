// User types
export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  email: string
  role: UserRole
  created_at: string
}

// Product types
export interface Product {
  id: string
  name: string
  description: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

// Document types
export interface Document {
  id: string
  product_id: string
  filename: string
  file_url: string
  file_size: number
  mime_type: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  uploaded_by: string
  created_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  content: string
  embedding: number[]
  chunk_index: number
  metadata: Record<string, unknown>
}

// Conversation types
export interface Conversation {
  id: string
  user_id: string
  product_id: string
  title: string | null
  created_at: string
  updated_at: string
}

export type MessageRole = 'user' | 'assistant' | 'system'
export type LLMProvider = 'claude' | 'openai' | 'gemini'

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  llm_used: LLMProvider | null
  created_at: string
}

// LLM types
export interface LLMConfig {
  provider: LLMProvider
  model: string
  temperature?: number
  maxTokens?: number
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LLMResponse {
  content: string
  provider: LLMProvider
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface StreamingLLMResponse {
  stream: ReadableStream<Uint8Array>
  provider: LLMProvider
  model: string
}

// RAG types
export interface ChunkWithScore {
  chunk: DocumentChunk
  score: number
}

export interface RAGContext {
  chunks: ChunkWithScore[]
  query: string
  productId: string
}

// API types
export interface ChatRequest {
  message: string
  conversationId?: string
  productId: string
  llmProvider?: LLMProvider
}

export interface ChatResponse {
  message: Message
  conversationId: string
}

export interface ProductsResponse {
  products: Product[]
}

export interface DocumentUploadResponse {
  document: Document
}

// Database types for Supabase
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: User
        Insert: Omit<User, 'created_at'>
        Update: Partial<Omit<User, 'id' | 'created_at'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>
      }
      documents: {
        Row: Document
        Insert: Omit<Document, 'id' | 'created_at'>
        Update: Partial<Omit<Document, 'id' | 'created_at'>>
      }
      document_chunks: {
        Row: DocumentChunk
        Insert: Omit<DocumentChunk, 'id'>
        Update: Partial<Omit<DocumentChunk, 'id'>>
      }
      conversations: {
        Row: Conversation
        Insert: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Conversation, 'id' | 'created_at' | 'updated_at'>>
      }
      messages: {
        Row: Message
        Insert: Omit<Message, 'id' | 'created_at'>
        Update: Partial<Omit<Message, 'id' | 'created_at'>>
      }
    }
  }
}
