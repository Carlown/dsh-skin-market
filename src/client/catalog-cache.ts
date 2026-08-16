import type { CatalogSkin } from './types.ts'

export interface CatalogCache {
  read(): Promise<CatalogSkin[] | null>
  write(skins: CatalogSkin[]): Promise<void>
}

const DATABASE = 'dsh-skin-market'
const STORE = 'catalog'
const KEY = 'latest-v1'

function openCatalogDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is unavailable'))
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open catalog cache'))
  })
}

function looksLikeCatalog(value: unknown): value is CatalogSkin[] {
  return Array.isArray(value) && value.every(item => typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string')
}

export const browserCatalogCache: CatalogCache = {
  async read() {
    let database: IDBDatabase | null = null
    try {
      database = await openCatalogDatabase()
      return await new Promise<CatalogSkin[] | null>((resolve, reject) => {
        const request = database!.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)
        request.onsuccess = () => resolve(looksLikeCatalog(request.result) ? request.result : null)
        request.onerror = () => reject(request.error ?? new Error('Failed to read catalog cache'))
      })
    } catch {
      return null
    } finally {
      database?.close()
    }
  },

  async write(skins) {
    let database: IDBDatabase | null = null
    try {
      database = await openCatalogDatabase()
      await new Promise<void>((resolve, reject) => {
        const transaction = database!.transaction(STORE, 'readwrite')
        transaction.objectStore(STORE).put(skins, KEY)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('Failed to write catalog cache'))
        transaction.onabort = () => reject(transaction.error ?? new Error('Catalog cache write aborted'))
      })
    } catch {
      // Cache failures must never block the live catalog.
    } finally {
      database?.close()
    }
  },
}
