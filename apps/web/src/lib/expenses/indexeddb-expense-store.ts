import { isSyncEligible, type ExpenseStore, type StoredExpense, type SyncStatusUpdate } from "@drivewise/shared";

/**
 * Web implementation of ExpenseStore, backed by IndexedDB. Mirrors
 * IndexedDbTripStore's structure exactly — this is the one place in the
 * app that talks to IndexedDB for expenses; ExpenseForm/SyncQueue only
 * ever see the ExpenseStore interface.
 *
 * Every write here goes straight to IndexedDB before the caller's promise
 * resolves — no in-memory buffer a crash or a killed tab could lose. A row
 * is never deleted until markSyncStatus has recorded "synced" (outside an
 * explicit driver-initiated delete).
 */
const DB_NAME = "drivewise-expenses";
const DB_VERSION = 1;
const EXPENSES_STORE = "expenses";

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EXPENSES_STORE)) {
        const store = db.createObjectStore(EXPENSES_STORE, { keyPath: "clientId" });
        store.createIndex("byUserId", "userId");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class IndexedDbExpenseStore implements ExpenseStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDb();
    return this.dbPromise;
  }

  private async getExpensesByUser(userId: string): Promise<StoredExpense[]> {
    const db = await this.db();
    const tx = db.transaction(EXPENSES_STORE, "readonly");
    const index = tx.objectStore(EXPENSES_STORE).index("byUserId");
    return promisify(index.getAll(IDBKeyRange.only(userId)));
  }

  async createExpense(expense: StoredExpense): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(EXPENSES_STORE, "readwrite");
    tx.objectStore(EXPENSES_STORE).put(expense);
    await promisifyTx(tx);
  }

  async updateExpense(clientId: string, patch: Partial<StoredExpense>): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(EXPENSES_STORE, "readwrite");
    const store = tx.objectStore(EXPENSES_STORE);
    const existing = await promisify<StoredExpense | undefined>(store.get(clientId));
    if (!existing) {
      throw new Error(`IndexedDbExpenseStore: no stored expense with clientId ${clientId}`);
    }
    store.put({ ...existing, ...patch });
    await promisifyTx(tx);
  }

  async getExpense(clientId: string): Promise<StoredExpense | null> {
    const db = await this.db();
    const tx = db.transaction(EXPENSES_STORE, "readonly");
    const result = await promisify<StoredExpense | undefined>(tx.objectStore(EXPENSES_STORE).get(clientId));
    return result ?? null;
  }

  async deleteExpense(clientId: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(EXPENSES_STORE, "readwrite");
    tx.objectStore(EXPENSES_STORE).delete(clientId);
    await promisifyTx(tx);
  }

  async listExpenses(userId: string): Promise<StoredExpense[]> {
    const expenses = await this.getExpensesByUser(userId);
    return expenses.sort((a, b) => b.incurredOn.localeCompare(a.incurredOn));
  }

  async listSyncable(userId: string, now: string): Promise<StoredExpense[]> {
    const expenses = await this.getExpensesByUser(userId);
    return expenses.filter((expense) => isSyncEligible(expense, now));
  }

  async markSyncStatus(clientId: string, update: SyncStatusUpdate): Promise<void> {
    const patch: Partial<StoredExpense> = {
      syncStatus: update.syncStatus,
      updatedAt: new Date().toISOString(),
    };
    if (update.serverId !== undefined) patch.serverId = update.serverId;
    if (update.syncError !== undefined) patch.syncError = update.syncError;
    if (update.syncRetryCount !== undefined) patch.syncRetryCount = update.syncRetryCount;
    if (update.nextSyncAttemptAt !== undefined) patch.nextSyncAttemptAt = update.nextSyncAttemptAt;
    await this.updateExpense(clientId, patch);
  }
}
