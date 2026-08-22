/* MPTEAM service worker — push notifications */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: "MPTEAM", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "MPTEAM";
  const options = {
    body: data.body || "",
    icon: data.icon || "/mp-logo.png",
    badge: data.badge || "/mp-logo.png",
    tag: data.tag || "mpteam-default",
    data: { url: data.url || "/aluno" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/aluno";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        try {
          const url = new URL(client.url);
          if (url.pathname.startsWith("/aluno") && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        } catch (_e) {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});