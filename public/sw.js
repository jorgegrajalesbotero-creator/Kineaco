// Service worker de Kineaco: recibe las notificaciones push aunque la app esté cerrada
// y las muestra en la barra del celular. Al tocarlas, abre la app en la sección del aviso.
// No guarda páginas en caché (la app siempre se carga en línea).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Kineaco";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/", id: data.id || null },
    lang: "es",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url = "/", id = null } = event.notification.data || {};
  const target = new URL(url, self.location.origin);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Si la app ya está abierta en la misma sección (app o panel), se usa esa ventana
      for (const client of windows) {
        const open = new URL(client.url);
        const samePart = open.origin === target.origin && open.pathname.startsWith("/admin") === target.pathname.startsWith("/admin");
        if (samePart && "focus" in client) {
          client.postMessage({ type: "open-notification", id });
          return client.focus();
        }
      }
      return self.clients.openWindow(target.href);
    })(),
  );
});
