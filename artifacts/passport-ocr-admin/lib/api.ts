import { getAuthToken, type Passport } from "@workspace/api-client-react";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
};

export async function uploadPassportFile(file: PickedFile): Promise<Passport> {
  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);

  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api/passports/upload`, {
    method: "POST",
    body: formData,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as Passport;
}

export function inferMimeType(uri: string, fallback: string = "image/jpeg"): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return fallback;
}

export function fileNameFromUri(uri: string, fallback: string = "passport.jpg"): string {
  const parts = uri.split("/");
  const last = parts[parts.length - 1];
  return last || fallback;
}
