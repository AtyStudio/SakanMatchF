// Intercept all global fetch calls to inject the JWT token if it exists.
// This ensures that all generated TanStack Query hooks automatically send the Authorization header.

const originalFetch = window.fetch;

window.fetch = async (...args) => {
  let [resource, config] = args;
  const token = localStorage.getItem("sakanmatch_token");
  
  if (token) {
    if (typeof resource === 'string' && resource.startsWith('/api')) {
      config = config || {};
      const headers = new Headers(config.headers);
      headers.set("Authorization", `Bearer ${token}`);
      config.headers = headers;
    } else if (resource instanceof Request && resource.url.includes('/api')) {
      resource.headers.set("Authorization", `Bearer ${token}`);
    }
  }
  
  return originalFetch(resource, config);
};

export {};
