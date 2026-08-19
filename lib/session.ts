import { cookies } from "next/headers";

export interface ZeugoSession {
  userId:      string;
  username:    string;
  displayName: string;
  avatar:      string | null;
  accessToken: string;
  expiresAt:   number;
}





export async function getSession(): Promise<ZeugoSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("zeugo_session")?.value;
  if (!raw) return null;

  try {
    const session: ZeugoSession = JSON.parse(raw);

    if (Date.now() > session.expiresAt - 60_000) return null;
    return session;
  } catch {
    return null;
  }
}