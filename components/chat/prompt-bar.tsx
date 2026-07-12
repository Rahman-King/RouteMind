"use client"

import * as React from "react"
import { ArrowUp, Mic, Paperclip, Square, Sparkles, Loader2, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PromptBar({
  onSend,
  generating,
  onStop,
}: {
  onSend: (value: string) => void
  generating: boolean
  onStop?: () => void
}) {
  const [value, setValue] = React.useState("")
  const [recording, setRecording] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [uploadedImage, setUploadedImage] = React.useState<string | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const autoGrow = React.useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  React.useEffect(() => {
    autoGrow()
  }, [value, autoGrow])

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || generating) return
    
    // Include image URL if uploaded
    const message = uploadedImage 
      ? `${value.trim()}\n\n[Image: ${uploadedImage}]`
      : trimmed
    
    onSend(message)
    setValue("")
    setUploadedImage(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      e.keyCode !== 229
    ) {
      e.preventDefault()
      submit()
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setUploadedImage(data.url)
        toast.success('Image uploaded successfully')
      } else {
        toast.error(data.error || 'Failed to upload image')
      }
    } catch (error) {
      toast.error('Failed to upload image')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeImage = () => {
    setUploadedImage(null)
  }

  return (
    <div
      className={cn(
        "glass-strong rounded-3xl p-2.5 shadow-soft transition-all duration-300",
        focused && "ring-2 ring-ring/40 shadow-glow-sm",
      )}
      role="region"
      aria-label="Message input"
    >
      {uploadedImage && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/50 p-2">
          <ImageIcon className="size-4 text-brand-violet" aria-hidden="true" />
          <span className="flex-1 truncate text-xs text-muted-foreground">Image uploaded</span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 rounded-full"
            onClick={removeImage}
            aria-label="Remove image"
          >
            <Square className="size-3" />
          </Button>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={1}
        placeholder="Ask anything…"
        className="max-h-50 w-full resize-none bg-transparent px-2.5 py-1.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground transition-all duration-200"
        aria-label="Type your message"
      />
      <div className="flex items-center gap-2 px-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          aria-label="Upload image"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full transition-all duration-200 hover:scale-110 focus:scale-110"
          aria-label="Attach file"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Paperclip className="transition-transform duration-200 hover:rotate-12" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            "rounded-full transition-all duration-200 hover:scale-110 focus:scale-110",
            recording && "bg-destructive/15 text-destructive animate-pulse",
          )}
          aria-label={recording ? "Stop recording" : "Start voice input"}
          onClick={() => {
            setRecording((r) => !r)
            toast(recording ? "Stopped recording" : "Recording… (preview only)")
          }}
        >
          <Mic className={cn(recording && "text-destructive", "transition-transform duration-200 hover:scale-110")} />
        </Button>

        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline" aria-hidden="true">
          Enter to send · Shift+Enter for new line
        </span>

        {generating ? (
          <Button
            variant="outline"
            size="icon"
            className="rounded-full transition-all duration-200 hover:scale-110 hover:bg-destructive/10 hover:text-destructive"
            aria-label="Stop generating"
            onClick={onStop}
          >
            <Square className="size-3.5 transition-transform duration-200 hover:scale-110" />
          </Button>
        ) : (
          <Button
            variant="hero"
            size="icon"
            className={cn(
              "rounded-full transition-all duration-200 hover:scale-110 hover:shadow-glow-sm",
              (value.trim() || uploadedImage) && "animate-glow-pulse"
            )}
            aria-label="Send message"
            disabled={!value.trim() && !uploadedImage}
            onClick={submit}
          >
            {(value.trim() || uploadedImage) ? (
              <ArrowUp className="transition-transform duration-200 group-hover:-translate-y-0.5" />
            ) : (
              <Sparkles className="size-4 text-muted-foreground" />
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
