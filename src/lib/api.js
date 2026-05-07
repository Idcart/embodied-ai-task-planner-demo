const headers = { "Content-Type": "application/json" };
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function postJson(url, payload) {
  const response = await fetch(apiUrl(url), {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  return response.json();
}

export function runPerception(payload) {
  if (payload?.imageFile) {
    const formData = new FormData();
    formData.append("image", payload.imageFile);

    return fetch(apiUrl("/perception"), {
      method: "POST",
      body: formData
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `请求失败：${response.status}`);
      }
      return data;
    });
  }

  return postJson("/perception", payload);
}

export function runLiveFramePerception(imageBlob) {
  const formData = new FormData();
  formData.append("image", imageBlob, "camera-frame.jpg");

  return fetch(apiUrl("/perception/live-frame"), {
    method: "POST",
    body: formData
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || `请求失败：${response.status}`);
    }
    return data;
  });
}

export function generatePlan(payload) {
  return postJson("/plan", payload);
}

export function executePlan(payload) {
  return postJson("/execute", payload);
}

export function getHardwareStatus() {
  return fetch(apiUrl("/hardware/status")).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `请求失败：${response.status}`);
    }
    return data;
  });
}

export function executeHardwareStep(payload) {
  return postJson("/hardware/execute-step", payload);
}

export function executeHardwarePlan(payload) {
  return postJson("/hardware/execute-plan", payload);
}
