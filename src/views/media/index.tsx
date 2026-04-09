"use client"

import { FileText } from "lucide-react"

export default function MediaView({ initialPath }: { initialPath?: string }) {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <div className="text-center">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Media View</p>
        <p className="text-xs mt-1">Knowledge base browser</p>
        {initialPath && (
          <p className="text-xs mt-1 text-primary">{initialPath}</p>
        )}
      </div>
    </div>
  )
}
