import { type NextRequest, NextResponse } from "next/server";
import { trainingStatuses } from "@/lib/training-store";

export async function GET(request: NextRequest) {
  try {
    // Workaround for a persistent Next.js issue with dynamic route params.
    // We parse the ID directly from the URL pathname.
    const trainingId = request.nextUrl.pathname.split("/").pop();

    if (!trainingId) {
      return NextResponse.json(
        { error: "Could not parse training ID from URL" },
        { status: 400 }
      );
    }

    const status = trainingStatuses.get(trainingId);

    if (!status) {
      return NextResponse.json({ error: "Training not found" }, { status: 404 });
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error("Failed to get training status:", error);
    return NextResponse.json(
      { error: "Failed to get training status" },
      { status: 500 }
    );
  }
}
