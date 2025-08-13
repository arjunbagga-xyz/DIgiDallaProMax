import { type NextRequest, NextResponse } from "next/server"
import { trainingStatuses } from "@/lib/training-store"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trainingId = params.id
    const status = trainingStatuses.get(trainingId)

    if (!status) {
      return NextResponse.json({ error: "Training not found" }, { status: 404 })
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error("Failed to get training status:", error)
    return NextResponse.json(
      { error: "Failed to get training status" },
      { status: 500 }
    )
  }
}
