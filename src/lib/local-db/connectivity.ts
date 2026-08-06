export async function isServerOnline(): Promise<boolean> {
  try {
    const response = await fetch("/api/local-db/sync", {
      method: "HEAD",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkConnectivity(): Promise<boolean> {
  try {
    const response = await fetch("/api/local-db/sync", {
      method: "HEAD",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}
