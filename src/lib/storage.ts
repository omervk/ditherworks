// Minimal IndexedDB wrapper for persisting images and their cropY values
// Stored record shape: { id, name, size, type, lastModified, blob, y }

export type StoredImageRecord = {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  blob: Blob;
  y?: number;
};

const DB_NAME = 'image-crop-craft';
const DB_VERSION = 1;
const STORE = 'images';

let dbPromise: Promise<IDBDatabase> | null = null;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const openReq = indexedDB.open(DB_NAME, DB_VERSION);

    openReq.onupgradeneeded = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };

    openReq.onsuccess = () => resolve(openReq.result);
    openReq.onerror = () => reject(openReq.error);
  });
  return dbPromise;
}

export function createImageId(file: File): string {
  return `${file.name}__${file.size}__${file.lastModified}`;
}

export async function upsertImages(files: File[]): Promise<void> {
  if (files.length === 0) return;
  const db = await getDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);

  for (const file of files) {
    const id = createImageId(file);
    const existing: StoredImageRecord | undefined = await requestToPromise(
      store.get(id) as IDBRequest<StoredImageRecord | undefined>
    );
    if (!existing) {
      const record: StoredImageRecord = {
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        blob: file,
        y: undefined,
      };
      store.put(record);
    }
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getAllImages(): Promise<StoredImageRecord[]> {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const all = await requestToPromise(store.getAll() as IDBRequest<StoredImageRecord[]>);
  return all;
}

export async function getImageById(id: string): Promise<StoredImageRecord | undefined> {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const rec = await requestToPromise(store.get(id) as IDBRequest<StoredImageRecord | undefined>);
  return rec;
}

export async function updateImageY(id: string, y: number): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const existing: StoredImageRecord | undefined = await requestToPromise(
    store.get(id) as IDBRequest<StoredImageRecord | undefined>
  );
  if (existing) {
    existing.y = y;
    store.put(existing);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function removeImage(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function clearAllImages(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}


