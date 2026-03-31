/**
 * IndexedDB store for PDF files.
 * Stores PDFs alongside analysis results so they can be restored
 * when loading old analyses from history.
 */

const DB_NAME = "disclosure-checklist-pdfs";
const STORE_NAME = "pdfs";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePdf(id: string, file: File): Promise<void> {
  try {
    const db = await openDB();
    const arrayBuffer = await file.arrayBuffer();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({
      id,
      data: arrayBuffer,
      name: file.name,
      type: file.type,
      savedAt: Date.now(),
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Clean up old entries (keep last 10)
    const allKeys = await new Promise<string[]>((resolve, reject) => {
      const tx2 = db.transaction(STORE_NAME, "readonly");
      const req = tx2.objectStore(STORE_NAME).getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });

    if (allKeys.length > 10) {
      const tx3 = db.transaction(STORE_NAME, "readwrite");
      const s = tx3.objectStore(STORE_NAME);
      // Delete oldest entries beyond 10
      const toDelete = allKeys.slice(0, allKeys.length - 10);
      for (const key of toDelete) {
        s.delete(key);
      }
    }
  } catch (err) {
    console.error("Failed to save PDF to IndexedDB:", err);
  }
}

export async function loadPdf(id: string): Promise<File | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const result = await new Promise<{
      data: ArrayBuffer;
      name: string;
      type: string;
    } | null>((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (!result) return null;

    return new File([result.data], result.name, { type: result.type });
  } catch (err) {
    console.error("Failed to load PDF from IndexedDB:", err);
    return null;
  }
}
