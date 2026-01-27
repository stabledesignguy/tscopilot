import { User } from 'lucide-react'

interface AvatarProps {
  src?: string | null
  alt?: string
  size?: 'sm' | 'md' | 'lg'
  fallback?: string
}

export function Avatar({ src, alt = '', size = 'md', fallback }: AvatarProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${sizes[size]} rounded-full object-cover`}
      />
    )
  }

  return (
    <div
      className={`${sizes[size]} rounded-full bg-secondary-200 flex items-center justify-center text-secondary-600 font-medium`}
    >
      {fallback ? (
        fallback.charAt(0).toUpperCase()
      ) : (
        <User className={iconSizes[size]} />
      )}
    </div>
  )
}
