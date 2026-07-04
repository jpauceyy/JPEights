export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("cod_balancer_token");
  const options = init ? { ...init } : {};
  if (token) {
    const headers = options.headers ? { ...options.headers } : {};
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    options.headers = headers;
  }
  return window.fetch(input, options);
}
