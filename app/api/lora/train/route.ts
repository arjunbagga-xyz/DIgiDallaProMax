import { type NextRequest, NextResponse } from "next/server";

// This route redirects requests from the old /api/lora/train endpoint to the new v2 endpoint

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const newUrl = `${baseUrl}/api/lora/v2/train`;
  
  try {
    const body = await request.json();
    
    const response = await fetch(newUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error redirecting to v2 endpoint:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const newUrl = `${baseUrl}/api/lora/v2/train`;
  
  try {
    const response = await fetch(newUrl, {
      method: "GET",
      headers: request.headers,
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error redirecting to v2 endpoint:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const newUrl = `${baseUrl}/api/lora/v2/train`;
  
  try {
    const response = await fetch(newUrl, {
      method: "DELETE",
      headers: request.headers,
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error redirecting to v2 endpoint:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}