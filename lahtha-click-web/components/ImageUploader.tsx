'use client'

import { useState } from 'react'

interface ImageUploaderProps {
  images: string[]
  onChange: (images: string[]) => void
  maxImages?: number
  maxSizeMB?: number
}

export function ImageUploader({
  images,
  onChange,
  maxImages = 5,
  maxSizeMB = 2,
}: ImageUploaderProps) {
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    setError('')

    if (images.length + files.length > maxImages) {
      setError(`الحد الأقصى ${maxImages} صور`)
      return
    }

    setUploading(true)
    try {
      const newImages: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file.type.startsWith('image/')) {
          setError('الرجاء اختيار ملفات صور فقط')
          continue
        }
        if (file.size > maxSizeMB * 1024 * 1024) {
          setError(`حجم الصورة يجب أن يكون أقل من ${maxSizeMB}MB`)
          continue
        }
        const dataUrl = await readFileAsDataUrl(file)
        newImages.push(dataUrl)
      }
      onChange([...images, ...newImages])
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {images.map((img, idx) => (
          <div key={idx} className="relative group">
            <img
              src={img}
              alt={`Image ${idx + 1}`}
              className="w-full h-32 object-cover rounded-lg border border-ink-900/10"
            />
            <button
              type="button"
              onClick={() => removeImage(idx)}
              className="absolute top-1 left-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
            >
              ✕
            </button>
            {idx === 0 && (
              <div className="absolute bottom-1 right-1 bg-coral-500 text-white text-xs px-2 py-0.5 rounded">
                رئيسية
              </div>
            )}
          </div>
        ))}

        {images.length < maxImages && (
          <label className="border-2 border-dashed border-ink-900/20 rounded-lg h-32 flex flex-col items-center justify-center cursor-pointer hover:border-coral-500 hover:bg-coral-50/30 transition">
            <div className="text-2xl mb-1">📷</div>
            <p className="text-xs text-ink-900/60">{uploading ? 'جاري الرفع...' : 'إضافة صورة'}</p>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      <p className="text-xs text-ink-900/60">
        {images.length}/{maxImages} صور — حد أقصى {maxSizeMB}MB لكل صورة
      </p>
    </div>
  )
}
