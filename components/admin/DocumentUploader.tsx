'use client'

import { useState, useRef, type ChangeEvent } from 'react'
import { Upload, File, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { formatFileSize } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/useTranslation'

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
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export function DocumentUploader({
  productId,
  onUploadComplete,
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadingFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return

    const validFiles: UploadingFile[] = []

    Array.from(selectedFiles).forEach((file) => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      const isValidType =
        ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext)
      const isValidSize = file.size <= MAX_FILE_SIZE

      if (isValidType && isValidSize) {
        validFiles.push({
          file,
          progress: 0,
          status: 'uploading',
        })
      } else if (!isValidSize) {
        validFiles.push({
          file,
          progress: 0,
          status: 'error',
          error: t('documents.fileTooLarge'),
        })
      }
    })

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles])
      validFiles
        .filter((f) => f.status === 'uploading')
        .forEach((f) => uploadFileDirect(f.file))
    }
  }

  const uploadFileDirect = async (file: File) => {
    try {
      // Step 1: Get signed upload URL from our API
      const urlResponse = await fetch('/api/documents/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          productId,
          contentType: file.type,
        }),
      })

      if (!urlResponse.ok) {
        const data = await urlResponse.json()
        throw new Error(data.error || 'Failed to get upload URL')
      }

      const { signedUrl, path, token } = await urlResponse.json()

      // Step 2: Upload directly to Supabase Storage
      setFiles((prev) =>
        prev.map((f) =>
          f.file === file ? { ...f, progress: 30 } : f
        )
      )

      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage')
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.file === file ? { ...f, progress: 70 } : f
        )
      )

      // Step 3: Register the document in our database
      const registerResponse = await fetch('/api/documents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          productId,
          filePath: path,
          fileSize: file.size,
          mimeType: file.type,
        }),
      })

      if (!registerResponse.ok) {
        const data = await registerResponse.json()
        throw new Error(data.error || 'Failed to register document')
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
            : 'border-secondary-300 hover:border-secondary-400'
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
            isDragging ? 'text-primary-500' : 'text-secondary-400'
          }`}
        />
        <p className="text-sm text-secondary-600 mb-1">
          {t('documents.dragAndDrop')}
        </p>
        <p className="text-xs text-secondary-400">
          {t('documents.supportedFormats')}
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((item, index) => (
            <div
              key={`${item.file.name}-${index}`}
              className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg"
            >
              <File className="w-5 h-5 text-secondary-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary-700 truncate">
                  {item.file.name}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-secondary-400">
                    {formatFileSize(item.file.size)}
                  </p>
                  {item.status === 'uploading' && item.progress > 0 && (
                    <p className="text-xs text-primary-500">
                      {item.progress}%
                    </p>
                  )}
                </div>
                {item.status === 'uploading' && (
                  <div className="mt-1 h-1 bg-secondary-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {item.status === 'uploading' && (
                <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
              )}
              {item.status === 'success' && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {item.status === 'error' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">{item.error}</span>
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <button
                    onClick={() => removeFile(item.file)}
                    className="p-1 hover:bg-secondary-200 rounded"
                  >
                    <X className="w-4 h-4 text-secondary-400" />
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
