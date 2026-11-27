const healthStatus = document.querySelector("#health-status");

async function showHealth() {
  try {
    const response = await fetch("/healthz");
    if (!response.ok) throw new Error("Health check failed");
    const health = await response.json();
    healthStatus.textContent = `Service: ${health.status}`;
  } catch {
    healthStatus.textContent = "Service: unavailable";
  }
}

showHealth();
