'use client'

import { useState, useRef, type ChangeEvent } from 'react'
import { Upload, File, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatFileSize } from '@/lib/utils'

interface DocumentUploaderProps {
  productId: string
  onUploadComplete: () => void
}

interface UploadingFile {
  file: File
  progress: number
  status: 'uploading' | 'success' | 'error'
  error?: string
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md']

export function DocumentUploader({
  productId,
  onUploadComplete,
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadingFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return

    const validFiles: UploadingFile[] = []

    Array.from(selectedFiles).forEach((file) => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      const isValid =
        ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext)

      if (isValid) {
        validFiles.push({
          file,
          progress: 0,
          status: 'uploading',
        })
      }
    })

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles])
      validFiles.forEach((f) => uploadFile(f.file))
    }
  }

  const uploadFile = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('productId', productId)

    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.file === file ? { ...f, progress: 100, status: 'success' } : f
        )
      )
      onUploadComplete()
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.file === file
            ? {
                ...f,
                status: 'error',
                error: error instanceof Error ? error.message : 'Upload failed',
              }
            : f
        )
      )
    }
  }

  const removeFile = (file: File) => {
    setFiles((prev) => prev.filter((f) => f.file !== file))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleFileSelect(e.target.files)
          }
          className="hidden"
        />
        <Upload
          className={`w-10 h-10 mx-auto mb-3 ${
            isDragging ? 'text-primary-500' : 'text-slate-400'
          }`}
        />
        <p className="text-sm text-slate-600 mb-1">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-xs text-slate-400">
          Supported: PDF, DOCX, TXT, Markdown
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((item, index) => (
            <div
              key={`${item.file.name}-${index}`}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
            >
              <File className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {item.file.name}
                </p>
                <p className="text-xs text-slate-400">
                  {formatFileSize(item.file.size)}
                </p>
              </div>
              {item.status === 'uploading' && (
                <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
              )}
              {item.status === 'success' && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {item.status === 'error' && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <button
                    onClick={() => removeFile(item.file)}
                    className="p-1 hover:bg-slate-200 rounded"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
