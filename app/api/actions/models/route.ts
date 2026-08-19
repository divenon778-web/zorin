import { NextResponse } from "next/server"
import { CORS_HEADERS, handleOptions } from "@/lib/cors"

export async function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  return NextResponse.json({ message: "Not in use anymore." }, { status: 410, headers: CORS_HEADERS })
}