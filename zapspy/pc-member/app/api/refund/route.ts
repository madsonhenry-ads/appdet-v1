import { type NextRequest, NextResponse } from "next/server"

const BACKEND_URL = "https://zappspy-backend-v1-production.up.railway.app"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const response = await fetch(`${BACKEND_URL}/api/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Refund proxy error:", error)
    return NextResponse.json(
      { error: "Failed to submit refund request" },
      { status: 500 }
    )
  }
}