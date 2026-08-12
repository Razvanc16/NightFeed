// Service worker minimal — doar pentru Web Push. Nu face caching/offline,
// ca să nu interfereze cu Vite în dezvoltare sau cu build-ul de producție.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Semnal trimis explicit de pagină (App.jsx) la fiecare schimbare de
// vizibilitate — completează clients.matchAll() de mai jos, care în unele
// browsere (mai ales PWA instalat pe Android, în modul standalone) nu
// raportează corect visibilityState pe WindowClient.
let appVisible = false;
self.addEventListener("message", (event) => {
  if (event.data?.type === "visibility") appVisible = !!event.data.visible;
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "NightFeed", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "NightFeed";
  const options = {
    body: data.body || "",
    tag: data.tag || "nightfeed",
    data: { url: data.url || "/" },
  };

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Dacă ai deja un tab NightFeed deschis și vizibil, notificarea apare
      // în aplicație (toast + sunet propriu) — nu mai dublăm cu bannerul de
      // sistem, care ar suna și ca orice altă notificare de pe telefon.
      const matchAllVisible = clientList.some((c) => c.visibilityState === "visible");
      if (appVisible || matchAllVisible) return;
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
