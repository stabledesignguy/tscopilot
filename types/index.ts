// User types
export type UserRole = 'user' | 'admin'
export type OrgRole = 'user' | 'admin'

export interface User {
  id: string
  email: string
  role: UserRole
  is_super_admin: boolean
  is_active: boolean
  created_at: string
}

// Organization types
export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OrganizationSettings {
  id: string
  organization_id: string
  llm_provider: LLMProvider | null
  llm_model: string | null
  system_instructions: string | null
  max_users: number
  max_products: number
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: OrgRole
  invited_by: string | null
  joined_at: string
  is_active: boolean
  // Joined data
  user?: User
  organization?: Organization
}

export interface OrganizationInvitation {
  id: string
  organization_id: string
  email: string
  role: OrgRole
  token: string
  invited_by: string | null
  expires_at: string
  accepted_at: string | null
  created_at: string
  // Joined data
  organization?: Organization
  inviter?: User
}

// Group types
export interface Group {
  id: string
  name: string
  description: string | null
  organization_id: string | null
  created_at: string
  updated_at: string
  products?: Product[]
}

// Product types
export interface Product {
  id: string
  name: string
  description: string | null
  image_url: string | null
  group_id: string | null
  organization_id: string | null
  created_at: string
  updated_at: string
  group?: Group
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
  organization_id: string | null
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

// System Instructions types
export interface SystemInstruction {
  id: string
  instructions: string
  organization_id: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
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
  organizationId?: string
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
      organizations: {
        Row: Organization
        Insert: Omit<Organization, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Organization, 'id' | 'created_at' | 'updated_at'>>
      }
      organization_settings: {
        Row: OrganizationSettings
        Insert: Omit<OrganizationSettings, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<OrganizationSettings, 'id' | 'created_at' | 'updated_at'>>
      }
      organization_members: {
        Row: OrganizationMember
        Insert: Omit<OrganizationMember, 'id' | 'joined_at'>
        Update: Partial<Omit<OrganizationMember, 'id' | 'joined_at'>>
      }
      organization_invitations: {
        Row: OrganizationInvitation
        Insert: Omit<OrganizationInvitation, 'id' | 'created_at'>
        Update: Partial<Omit<OrganizationInvitation, 'id' | 'created_at'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>
      }
      groups: {
        Row: Group
        Insert: Omit<Group, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Group, 'id' | 'created_at' | 'updated_at'>>
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
      system_instructions: {
        Row: SystemInstruction
        Insert: Omit<SystemInstruction, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SystemInstruction, 'id' | 'created_at' | 'updated_at'>>
      }
    }
  }
}
