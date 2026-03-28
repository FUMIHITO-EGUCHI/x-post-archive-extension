/*
Run this one-off migration in the DevTools console of the extension's viewer page
or service worker, where the extension origin's IndexedDB is accessible.

Steps:
1. Open the unpacked extension.
2. Open the viewer page or the background/service worker DevTools.
3. Paste this file into the console and run it.

What it does:
- Reads posts from the legacy DB: x-post-archive
- Stores a raw backup in: x-post-archive-backup-v1
- Converts restorable posts into the current schema
- Recreates the target DB: x-post-archive-posts-v1
- Inserts migrated posts into the target DB
*/

(async () => {
  const LEGACY_DB_NAME = "x-post-archive";
  const TARGET_DB_NAME = "x-post-archive-posts-v1";
  const BACKUP_DB_NAME = "x-post-archive-backup-v1";
  const TARGET_STORE_NAME = "posts";

  const legacySnapshot = await snapshotDatabase(LEGACY_DB_NAME);

  if (legacySnapshot === null) {
    console.info(`[migration] Legacy DB not found: ${LEGACY_DB_NAME}`);
    return;
  }

  await writeBackup(BACKUP_DB_NAME, legacySnapshot);

  const postsStore = legacySnapshot.stores.find((store) => store.name === TARGET_STORE_NAME);
  const migratedPosts = (postsStore?.records ?? [])
    .map(normalizeLegacyPost)
    .filter((post) => post !== null);

  await deleteDatabaseIfExists(TARGET_DB_NAME);
  await writeTargetDatabase(TARGET_DB_NAME, TARGET_STORE_NAME, migratedPosts);

  console.info("[migration] Completed.", {
    backupDb: BACKUP_DB_NAME,
    sourceDb: LEGACY_DB_NAME,
    targetDb: TARGET_DB_NAME,
    migratedCount: migratedPosts.length,
    skippedCount: (postsStore?.records.length ?? 0) - migratedPosts.length
  });

  function snapshotDatabase(databaseName) {
    return new Promise((resolve, reject) => {
      const openRequest = indexedDB.open(databaseName);

      openRequest.onerror = () => {
        reject(openRequest.error ?? new Error(`Failed to open DB: ${databaseName}`));
      };

      openRequest.onupgradeneeded = () => {
        openRequest.transaction?.abort();
        resolve(null);
      };

      openRequest.onsuccess = async () => {
        const db = openRequest.result;

        try {
          const storeNames = Array.from(db.objectStoreNames);
          const stores = [];

          for (const storeName of storeNames) {
            const records = await readAllRecords(db, storeName);
            stores.push({
              name: storeName,
              records
            });
          }

          resolve({
            sourceDbName: databaseName,
            createdAt: Date.now(),
            stores
          });
        } catch (error) {
          reject(error);
        } finally {
          db.close();
        }
      };
    });
  }

  function readAllRecords(db, storeName) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => {
        reject(request.error ?? new Error(`Failed to read store: ${storeName}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }

  function writeBackup(databaseName, snapshot) {
    return new Promise((resolve, reject) => {
      const openRequest = indexedDB.open(databaseName, 1);

      openRequest.onerror = () => {
        reject(openRequest.error ?? new Error(`Failed to open backup DB: ${databaseName}`));
      };

      openRequest.onupgradeneeded = () => {
        const db = openRequest.result;

        if (!db.objectStoreNames.contains("backups")) {
          db.createObjectStore("backups", {
            keyPath: "id",
            autoIncrement: true
          }).createIndex("createdAt", "createdAt", {
            unique: false
          });
        }
      };

      openRequest.onsuccess = () => {
        const db = openRequest.result;
        const transaction = db.transaction("backups", "readwrite");
        const store = transaction.objectStore("backups");

        transaction.oncomplete = () => {
          db.close();
          resolve(undefined);
        };

        transaction.onerror = () => {
          reject(transaction.error ?? new Error("Failed to write backup snapshot."));
        };

        store.add(snapshot);
      };
    });
  }

  function deleteDatabaseIfExists(databaseName) {
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(databaseName);

      deleteRequest.onerror = () => {
        reject(deleteRequest.error ?? new Error(`Failed to delete DB: ${databaseName}`));
      };

      deleteRequest.onblocked = () => {
        reject(new Error(`Delete blocked for DB: ${databaseName}`));
      };

      deleteRequest.onsuccess = () => {
        resolve(undefined);
      };
    });
  }

  function writeTargetDatabase(databaseName, storeName, posts) {
    return new Promise((resolve, reject) => {
      const openRequest = indexedDB.open(databaseName, 1);

      openRequest.onerror = () => {
        reject(openRequest.error ?? new Error(`Failed to open target DB: ${databaseName}`));
      };

      openRequest.onupgradeneeded = () => {
        const db = openRequest.result;

        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, {
            keyPath: "x_post_id"
          }).createIndex("saved_at", "saved_at", {
            unique: false
          });
        }
      };

      openRequest.onsuccess = () => {
        const db = openRequest.result;
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);

        transaction.oncomplete = () => {
          db.close();
          resolve(undefined);
        };

        transaction.onerror = () => {
          reject(transaction.error ?? new Error("Failed to write migrated posts."));
        };

        for (const post of posts) {
          store.put(post);
        }
      };
    });
  }

  function normalizeLegacyPost(record) {
    if (typeof record !== "object" || record === null) {
      return null;
    }

    const candidate = record;
    const savedAt = normalizeSavedAt(candidate.savedAt);

    if (
      !isNonEmptyString(candidate.id) ||
      !isNonEmptyString(candidate.authorHandle) ||
      !isNonEmptyString(candidate.content) ||
      !isNonEmptyString(candidate.permalink) ||
      savedAt === null
    ) {
      return null;
    }

    return {
      x_post_id: candidate.id,
      x_username: candidate.authorHandle.replace(/^@/, ""),
      post_text: candidate.content,
      post_url: candidate.permalink,
      saved_at: savedAt
    };
  }

  function normalizeSavedAt(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value !== "string" || value.trim() === "") {
      return null;
    }

    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "";
  }
})().catch((error) => {
  console.error("[migration] Failed.", error);
});
