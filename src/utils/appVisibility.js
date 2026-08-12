// Semnalul "e aplicația deschisă chiar acum" trebuie citit de service worker
// la fiecare push, chiar dacă SW-ul tocmai a fost repornit de browser (i-a
// resetat orice variabilă ținută doar în memorie). IndexedDB e singurul
// mecanism pe care îl pot citi ambele părți (pagina și service worker-ul)
// și care supraviețuiește repornirilor SW — de asta nu folosim doar
// postMessage sau o variabilă simplă.
const DB_NAME = "nightfeed-meta";
const STORE = "kv";
const KEY = "visibility";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function setAppVisible(visible) {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ visible, ts: Date.now() }, KEY);
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    // best-effort — dacă IndexedDB nu e disponibil, sw.js cade pe verificarea prin clients.matchAll
  }
}
