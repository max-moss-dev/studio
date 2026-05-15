import { NextRequest } from "next/server"
import {
  createAppWorkspace,
  getAppWorkspace,
  listAppFiles,
  listAppWorkspaces,
  readAppFile,
  writeAppFile,
} from "@/lib/app-workspaces"

export async function GET() {
  return Response.json({ apps: await listAppWorkspaces() })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action } = body as { action: string }

  try {
    switch (action) {
      case "create":
        return Response.json({ app: await createAppWorkspace(body) })
      case "get":
        return Response.json({ app: await getAppWorkspace(body.appId) })
      case "files.list":
        return Response.json({ files: await listAppFiles(body.appId) })
      case "files.read":
        return Response.json(await readAppFile(body.appId, body.filePath))
      case "files.write":
        return Response.json(await writeAppFile(body.appId, body.filePath, body.content ?? ""))
      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
