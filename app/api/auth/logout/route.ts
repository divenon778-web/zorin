import { NextResponse } from "next/server";

export async function GET() {
  const response = NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
  );
  response.cookies.delete("zorin_session");
  return response;
}