import { type NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const characters = await prisma.character.findMany();
    return NextResponse.json({ characters });
  } catch (error) {
    console.error("Failed to load characters:", error);
    return NextResponse.json(
      { error: "Failed to load characters" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, personality, backstory, instagramHandle, preferredModel, triggerWord, promptSettings } = body;

    if (!name || !personality) {
      return NextResponse.json(
        { error: "Name and personality are required" },
        { status: 400 }
      );
    }

    const newCharacter = await prisma.character.create({
      data: {
        name,
        personality,
        backstory: backstory || "",
        instagramHandle: instagramHandle || "",
        isActive: true,
        preferredModel,
        triggerWord,
        promptSettings,
      },
    });

    return NextResponse.json({ character: newCharacter }, { status: 201 });
  } catch (error) {
    console.error("Failed to create character:", error);
    return NextResponse.json(
      { error: "Failed to create character" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Character ID is required" },
        { status: 400 }
      );
    }

    const updatedCharacter = await prisma.character.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ character: updatedCharacter });
  } catch (error) {
    console.error("Failed to update character:", error);
    return NextResponse.json(
      { error: "Failed to update character" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Character ID is required" },
        { status: 400 }
      );
    }

    await prisma.character.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete character:", error);
    return NextResponse.json(
      { error: "Failed to delete character" },
      { status: 500 }
    );
  }
}
