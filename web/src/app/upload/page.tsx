'use client'

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import { Loader2, UploadCloud, Image as ImageIcon, Info } from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export const dynamic = 'force-dynamic'

interface UploadResult {
  id: string
  storage_path: string
  original_filename: string
  exif_datetime: string | null
  exif_location_lat: number | null
  exif_location_lng: number | null
  created_at: string
}

export default function UploadPage() {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    setUploading(true)

    try {
      const results: UploadResult[] = []

      for (const file of acceptedFiles) {
        const formData = new FormData()
        formData.append('file', file)

        // Get the current session token
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          toast.error(`Failed to upload ${file.name}: No session found`)
          continue
        }

        const response = await fetch('/api/uploads', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: formData,
        })

        if (response.ok) {
          const data = await response.json()
          results.push(data.upload)
          
          if (data.duplicate) {
            // File already exists - show warning toast
            toast.warning(`${file.name} was already uploaded`, {
              description: `Original upload from ${new Date(data.upload.created_at).toLocaleString()}`
            })
          } else {
            // New upload - show success toast
            toast.success(`Uploaded ${file.name}`)
          }
        } else {
          const error = await response.json()
          toast.error(`Failed to upload ${file.name}: ${error.error}`)
        }
      }

      setUploadResults(prev => [...results, ...prev])

    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: true,
    disabled: uploading
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">Upload bowling scoreboard</h1>
          <p className="text-sm text-muted-foreground">
            Upload photos of bowling scoreboards to automatically extract scores.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload images</CardTitle>
            <CardDescription>Drag and drop multiple scoreboard photos or browse your files.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted px-6 py-12 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isDragActive && 'border-primary/60 bg-muted/30',
                uploading && 'pointer-events-none opacity-60'
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-3">
                <UploadCloud className="h-12 w-12 text-muted-foreground" />
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-base font-medium text-foreground">Uploading…</p>
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <p className="text-base font-medium text-foreground">
                      Drag & drop bowling scoreboard images here
                    </p>
                    <p className="text-sm text-muted-foreground">or click to select files (JPG, PNG, GIF, WebP)</p>
                    {isDragActive && (
                      <p className="text-sm text-muted-foreground">Release to start uploading.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {uploadResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent uploads</CardTitle>
              <CardDescription>Most recent files you have uploaded this session.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {uploadResults.map((upload) => (
                  <li key={upload.id} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted/40">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {upload.original_filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded {new Date(upload.created_at).toLocaleString()}
                        </p>
                        {upload.exif_datetime && (
                          <p className="text-xs text-muted-foreground">
                            Photo taken {new Date(upload.exif_datetime).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/debug/upload">Debug</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Tips for best results</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Capture clear, well-lit photos of the entire scoreboard.</li>
              <li>Ensure bowler names and scores are sharp and legible.</li>
              <li>Include as many games/bowlers as possible in a single frame.</li>
              <li>EXIF metadata (date, time, location) is extracted automatically.</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
