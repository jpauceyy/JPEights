export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("cod_balancer_token");
  const options = init ? { ...init } : {};
  if (token) {
    const headers = options.headers ? { ...options.headers } : {};
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    options.headers = headers;
  }
  
  const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  let url = input;
  if (typeof input === "string" && input.startsWith("/")) {
    url = `${baseUrl}${input}`;
  }
  
  return window.fetch(url, options);
}
