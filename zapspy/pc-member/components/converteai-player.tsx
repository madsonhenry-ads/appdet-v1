"use client"

import { useEffect, useRef } from "react"

interface ConverteaiPlayerProps {
  videoId: string
  isPortrait?: boolean
}

export default function ConverteaiPlayer({ videoId, isPortrait = false }: ConverteaiPlayerProps) {
  const scriptLoadedRef = useRef(false)
  const padding = isPortrait ? "177.31%" : "56.25%"

  useEffect(() => {
    if (scriptLoadedRef.current) return
    scriptLoadedRef.current = true

    const script = document.createElement("script")
    script.src = `https://scripts.converteai.net/8671d2f6-c45f-4b55-9776-68f6c495a79a/players/${videoId}/v4/player.js`
    script.async = true
    document.head.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
      scriptLoadedRef.current = false
    }
  }, [videoId])

  return (
    <div
      dangerouslySetInnerHTML={{
        __html: `
          <vturb-smartplayer
            id="vid-${videoId}"
            style="display: block; margin: 0 auto; width: 100%;"
          >
            <div
              class="vturb-player-placeholder"
              style="position: relative; width: 100%; padding: ${padding} 0 0; z-index: 0; background-color: black;"
            ></div>
          </vturb-smartplayer>
        `,
      }}
    />
  )
}