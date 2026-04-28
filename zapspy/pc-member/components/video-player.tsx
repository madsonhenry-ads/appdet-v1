"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Play } from "lucide-react"

interface VideoPlayerProps {
  videoUrl: string
  videoType: "youtube" | "vimeo" | "direct"
  title: string
  onComplete?: () => void
  isCompleted?: boolean
}

export default function VideoPlayer({
  videoUrl,
  videoType,
  title,
  onComplete,
  isCompleted = false,
}: VideoPlayerProps) {
  const [isWatched, setIsWatched] = useState(isCompleted)
  const [watchedDuration, setWatchedDuration] = useState(0)

  const getEmbedUrl = () => {
    if (videoType === "youtube") {
      // Converter URL do YouTube para embed
      let videoId = videoUrl
      if (videoUrl.includes("youtube.com/embed/")) {
        videoId = videoUrl.split("embed/")[1]
      } else if (videoUrl.includes("youtu.be/")) {
        videoId = videoUrl.split("youtu.be/")[1]?.split("?")[0]
      } else if (videoUrl.includes("youtube.com/watch?v=")) {
        videoId = videoUrl.split("v=")[1]?.split("&")[0]
      }
      return `https://www.youtube.com/embed/${videoId}`
    }
    return videoUrl
  }

  const handleMarkComplete = () => {
    setIsWatched(true)
    if (onComplete) {
      onComplete()
    }
  }

  return (
    <div className="space-y-4">
      {/* Video Container */}
      <div className="relative w-full bg-black rounded-lg overflow-hidden">
        <div className="aspect-video">
          {videoType === "youtube" || videoType === "vimeo" ? (
            <iframe
              src={getEmbedUrl()}
              title={title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={videoUrl}
              controls
              className="w-full h-full"
              onTimeUpdate={(e) => {
                const duration = e.currentTarget.duration
                const currentTime = e.currentTarget.currentTime
                setWatchedDuration(currentTime)

                // Marcar como assistido se passou 80% do vídeo
                if (currentTime / duration > 0.8 && !isWatched) {
                  setIsWatched(true)
                }
              }}
            >
	            Your browser does not support video playback.
	          </video>
          )}
        </div>

        {/* Badge de Conclusão */}
        {isWatched && (
          <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full flex items-center gap-2 text-sm font-medium">
	            <CheckCircle2 className="w-4 h-4" />
	            Completed
	          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex gap-3 items-center">
	        {!isWatched && (
	          <Button onClick={handleMarkComplete} className="gap-2">
	            <CheckCircle2 className="w-4 h-4" />
	            Mark as Watched
	          </Button>
	        )}

	        {isWatched && (
	          <div className="flex items-center gap-2 text-green-600 font-medium">
	            <CheckCircle2 className="w-5 h-5" />
	            Lesson completed!
	          </div>
	        )}
      </div>

      {/* Info */}
	      <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
	        <p className="text-sm text-slate-600 dark:text-slate-400">
	          {videoType === "youtube" && "YouTube Video"}
	          {videoType === "vimeo" && "Vimeo Video"}
	          {videoType === "direct" && "Direct Video"}
	        </p>
	      </div>
    </div>
  )
}
