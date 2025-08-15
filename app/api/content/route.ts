import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const contentFilePath = path.join(process.cwd(), "data", "content.json")

async function getContent() {
  try {
    const data = await fs.readFile(contentFilePath, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    // Type guard to safely check for file not found error
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [] // File not found, return empty array
    }
    throw error // Re-throw other errors
  }
}

async function saveContent(content: any[]) {
  try {
    const data = JSON.stringify(content, null, 2)
    await fs.writeFile(contentFilePath, data, "utf-8")
  } catch (error) {
    console.error("Failed to save content:", error)
    throw new Error("Failed to save content.")
  }
}

export async function GET() {
  try {
    const content = await getContent()
    return NextResponse.json({ content })
  } catch (error) {
    console.error("Failed to get content:", error)
    return NextResponse.json(
      {
        error: "Failed to get content",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ error: "Missing content ID" }, { status: 400 })
    }

    const allContent = await getContent()
    const updatedContent = allContent.filter((c: any) => c.id !== id)

    if (allContent.length === updatedContent.length) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    await saveContent(updatedContent)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete content:", error)
    return NextResponse.json(
      {
        error: "Failed to delete content",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
