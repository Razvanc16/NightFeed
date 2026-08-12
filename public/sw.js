// Service worker minimal — doar pentru Web Push. Nu face caching/offline,
// ca să nu interfereze cu Vite în dezvoltare sau cu build-ul de producție.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Citim din IndexedDB dacă pagina e vizibilă chiar acum — scris de
// App.jsx (utils/appVisibility.js) la fiecare schimbare de vizibilitate,
// plus un heartbeat periodic cât timp rămâne vizibilă. IndexedDB (nu o
// variabilă în memorie) fiindcă browserul poate opri și reporni acest
// service worker oricând între evenimente, ștergându-i orice stare ținută
// doar în memorie — citirea directă evită să rămânem cu un semnal vechi.
function readAppVisible() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("nightfeed-meta", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("kv", "readonly");
        const getReq = tx.objectStore("kv").get("visibility");
        getReq.onsuccess = () => {
          const val = getReq.result;
          // Semnal valid doar dacă e recent — altfel un tab uitat deschis,
          // dar de fapt închis de mult (fără heartbeat de-atunci), ar bloca
          // pe bune notificările viitoare.
          resolve(!!(val && val.visible && Date.now() - val.ts < 25000));
        };
        getReq.onerror = () => resolve(false);
      };
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

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
    Promise.all([
      readAppVisible(),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }),
    ]).then(([dbVisible, clientList]) => {
      // Dacă ai deja un tab NightFeed deschis și vizibil, notificarea apare
      // în aplicație (toast + sunet propriu) — nu mai dublăm cu bannerul de
      // sistem, care ar suna și ca orice altă notificare de pe telefon.
      const matchAllVisible = clientList.some((c) => c.visibilityState === "visible");
      if (dbVisible || matchAllVisible) return;
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
