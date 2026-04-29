const headers = { "Content-Type": "application/json" };

async function postJson(url, payload) {
  const response = await fetch(url, {
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

    return fetch("/api/perception", {
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

  return postJson("/api/perception", payload);
}

export function generatePlan(payload) {
  return postJson("/api/plan", payload);
}

export function executePlan(payload) {
  return postJson("/api/execute", payload);
}
