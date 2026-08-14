const API_BASE = "http://localhost:8000";


async function request(
  endpoint,
  options = {}
) {
  const response = await fetch(
    `${API_BASE}${endpoint}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    }
  );


  if (!response.ok) {
    let errorMessage =
      `Request failed with status ${response.status}`;

    try {
      const errorData = await response.json();

      if (errorData.detail) {
        errorMessage = errorData.detail;
      }
    } catch {
      // Keep the default error.
    }

    throw new Error(errorMessage);
  }


  return response.json();
}


export async function getScenarios() {
  return request("/api/scenarios");
}


export async function getVault() {
  return request("/api/vault");
}


export async function executeStrategy(
  scenario,
  threshold
) {
  return request(
    "/api/execute",
    {
      method: "POST",

      body: JSON.stringify({
        scenario,
        threshold,
      }),
    }
  );
}


export async function resetDemo() {
  return request(
    "/api/reset",
    {
      method: "POST",
    }
  );
}