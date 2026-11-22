import { SaveGameData, SaveGameMeta, KnowledgeBase, GameMessage, TurnHistoryEntry } from '../types';
import { APP_VERSION, VIETNAMESE, MAX_AUTO_SAVE_SLOTS } from '../constants';
import { stripVectorsFromHistory, sanitizeVectorStorePrecision } from '../utils/turnHistoryUtils';

const DB_NAME = 'DaoDoAIDB';
const DB_VERSION = 5; 
const SAVES_STORE_NAME = 'gameSaves_v2'; 
export const VECTOR_STORE_NAME = 'original_work_vectors';
export const PALACE_STORE_NAME = 'knowledge_palace_v1';
export const PENDING_FILES_STORE = 'pending_vector_files';
export const VECTOR_JOBS_STORE = 'vectorization_jobs';
export const PENDING_CHUNKS_STORE = 'pending_vector_chunks';
const LOCAL_USER_ID = 'local_player'; 

let dbPromise: Promise<IDBDatabase> | null = null;

export const getDb = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error on open:', request.error);
        reject('Error opening IndexedDB.');
        dbPromise = null; 
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction;

        if (!db.objectStoreNames.contains(SAVES_STORE_NAME)) {
          const store = db.createObjectStore(SAVES_STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('name_userId', ['name', 'userId']);
          store.createIndex('userId_timestamp', ['userId', 'timestamp']);
        }
        if (!db.objectStoreNames.contains(VECTOR_STORE_NAME)) {
          db.createObjectStore(VECTOR_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(PALACE_STORE_NAME)) {
          db.createObjectStore(PALACE_STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(PENDING_FILES_STORE)) {
          db.createObjectStore(PENDING_FILES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(VECTOR_JOBS_STORE)) {
          db.createObjectStore(VECTOR_JOBS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(PENDING_CHUNKS_STORE)) {
          db.createObjectStore(PENDING_CHUNKS_STORE, { keyPath: 'id' });
        }
        else {
          if (transaction) {
            const store = transaction.objectStore(SAVES_STORE_NAME);
            if (!store.indexNames.contains('name_userId')) {
              store.createIndex('name_userId', ['name', 'userId']);
            }
             if (!store.indexNames.contains('userId_timestamp')) {
              store.createIndex('userId_timestamp', ['userId', 'timestamp']);
            }
          }
        }
      };
    });
  }
  return dbPromise;
};

export const saveGameToIndexedDB = async (
  knowledgeBase: KnowledgeBase,
  gameMessages: GameMessage[],
  saveName: string, 
  existingSaveId: string | number | null 
): Promise<string> => {
  const db = await getDb();
  const transaction = db.transaction(SAVES_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(SAVES_STORE_NAME);

  // Deep clone and prepare KnowledgeBase for DB
  const kbForDb = JSON.parse(JSON.stringify(knowledgeBase)) as KnowledgeBase;

  // Reduce floating point precision in top-level vector store to reduce JSON string size
  if (kbForDb.ragVectorStore) {
    kbForDb.ragVectorStore = sanitizeVectorStorePrecision(kbForDb.ragVectorStore);
  }

  // Strip duplicate heavy vector arrays from history snapshots to prevent database bloating
  if (kbForDb.turnHistory) {
    kbForDb.turnHistory = stripVectorsFromHistory(kbForDb.turnHistory);
  }

  // Optimize TurnHistory for DB storage
  if (kbForDb.turnHistory) {
    kbForDb.turnHistory = kbForDb.turnHistory.map((entry: TurnHistoryEntry) => {
      return {
        turnNumber: entry.turnNumber,
        type: entry.type || 'delta'
      } as any;
    });
  }
  
  // Ensure playerAvatarData only stores Cloudinary URL if available from worldConfig
  if (kbForDb.worldConfig?.playerAvatarUrl && kbForDb.worldConfig.playerAvatarUrl.startsWith('https://res.cloudinary.com')) {
    kbForDb.playerAvatarData = kbForDb.worldConfig.playerAvatarUrl;
  } else if (kbForDb.playerAvatarData && !kbForDb.playerAvatarData.startsWith('https://res.cloudinary.com') && !kbForDb.playerAvatarData.startsWith('data:image')) {
    // If playerAvatarData is neither Cloudinary URL nor base64, clear it if a non-Cloudinary URL is in worldConfig
    // or if worldConfig has no URL (to avoid saving invalid data)
    if (kbForDb.worldConfig?.playerAvatarUrl && !kbForDb.worldConfig.playerAvatarUrl.startsWith('https://res.cloudinary.com')){
         kbForDb.playerAvatarData = undefined; // Clear potentially invalid data
    } else if (!kbForDb.worldConfig?.playerAvatarUrl) {
         kbForDb.playerAvatarData = undefined;
    }
    // If playerAvatarData is base64 (data:image), it's likely a temporary upload state, don't save it long-term unless no Cloudinary URL.
    // The app logic should handle converting base64 to Cloudinary URL and updating worldConfig.playerAvatarUrl.
    // If worldConfig has a cloudinary URL, that takes precedence.
  }


  const gameDataToStore: Omit<SaveGameData, 'id'> & { userId: string, id?: string | number } = {
    name: saveName,
    timestamp: new Date(),
    // FIX: Removed appVersion from knowledgeBase object. It belongs at the root of SaveGameData.
    knowledgeBase: kbForDb,
    gameMessages,
    appVersion: APP_VERSION,
    userId: LOCAL_USER_ID,
  };

  let operation: IDBRequest;
  if (existingSaveId !== null && existingSaveId !== undefined) {
    const idToUse = typeof existingSaveId === 'string' ? parseInt(existingSaveId, 10) : existingSaveId;
    if (isNaN(idToUse as number) && typeof existingSaveId === 'string') {
        gameDataToStore.id = existingSaveId as string; 
    } else if (!isNaN(idToUse as number)) {
         gameDataToStore.id = idToUse as number; 
    }
    operation = store.put(gameDataToStore); 
  } else {
    const { id, ...dataWithoutId } = gameDataToStore;
    operation = store.add(dataWithoutId);
  }

  return new Promise<string>((resolve, reject) => {
    operation.onsuccess = () => {
      resolve(operation.result.toString());
    };
    operation.onerror = () => {
      const errorMsg = `Failed to save/update game locally. Details: ${operation.error?.message || 'Unknown error'}`;
      reject(new Error(errorMsg));
    };
  });
};


export const loadGamesFromIndexedDB = async (): Promise<SaveGameMeta[]> => {
  const db = await getDb();
  const transaction = db.transaction(SAVES_STORE_NAME, 'readonly');
  const store = transaction.objectStore(SAVES_STORE_NAME);
  const index = store.index('userId_timestamp');

  const range = IDBKeyRange.bound([LOCAL_USER_ID, new Date(0)], [LOCAL_USER_ID, new Date()]);

  return new Promise<SaveGameMeta[]>((resolve, reject) => {
    const request = index.getAll(range); 
    
    request.onsuccess = () => {
      const saves: SaveGameMeta[] = request.result
        .filter(item => item.userId === LOCAL_USER_ID) 
        .map(item => {
          let estimatedSize = 0;
          try {
            // Estimate size based on knowledgeBase and gameMessages only for better performance
            const sizeRelevantData = { kb: item.knowledgeBase, gm: item.gameMessages };
            estimatedSize = JSON.stringify(sizeRelevantData).length;
          } catch (e) {
            // Size estimation error
          }
          const turnCount = item.knowledgeBase?.playerStats?.turn ?? 0;
          const universeId = item.knowledgeBase?.universeId;
          return {
            id: item.id.toString(),
            name: item.name,
            timestamp: new Date(item.timestamp), 
            size: estimatedSize,
            turnCount,
            universeId,
          };
        })
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); 
      resolve(saves);
    };
    request.onerror = () => {
      console.error('Error loading games from IndexedDB:', request.error);
      reject(new Error(`Failed to load local games. Details: ${request.error?.message || 'Unknown error'}`));
    };
  });
};

export const loadSpecificGameFromIndexedDB = async (saveId: string): Promise<SaveGameData | null> => {
  const db = await getDb();
  const transaction = db.transaction(SAVES_STORE_NAME, 'readonly');
  const store = transaction.objectStore(SAVES_STORE_NAME);
  
  const numericId = parseInt(saveId, 10);

  return new Promise<SaveGameData | null>((resolve, reject) => {
    const keyToLoad = isNaN(numericId) ? saveId : numericId;
    const request = store.get(keyToLoad);

    request.onsuccess = () => {
      if (request.result && request.result.userId === LOCAL_USER_ID) {
        const data = request.result as SaveGameData;
        
        // Ensure turnHistory entries are valid
        if (data.knowledgeBase && data.knowledgeBase.turnHistory) {
          data.knowledgeBase.turnHistory = data.knowledgeBase.turnHistory.map(entry => ({
            turnNumber: entry.turnNumber,
            type: entry.type || 'delta'
          } as any));
        }

        resolve({
            ...data,
            id: data.id?.toString(), 
            timestamp: new Date(data.timestamp) 
        });
      } else if (request.result) { 
        resolve(null); 
      }
      else { 
        resolve(null);
      }
    };
    request.onerror = () => {
      console.error(`Error loading specific game (key: ${keyToLoad}) from IndexedDB:`, request.error);
      reject(new Error(`Failed to load specific local game. Details: ${request.error?.message || 'Unknown error'}`));
    };
  });
};

export const deleteGameFromIndexedDB = async (saveId: string): Promise<void> => {
  const db = await getDb();
  const transaction = db.transaction(SAVES_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(SAVES_STORE_NAME);
  
  const numericId = parseInt(saveId, 10);
  const keyToDelete = isNaN(numericId) ? saveId : numericId;

  return new Promise<void>((resolve, reject) => {
    const getRequest = store.get(keyToDelete); 
    
    getRequest.onsuccess = () => {
      if (getRequest.result) { 
        if (getRequest.result.userId === LOCAL_USER_ID) { 
          const deleteRequest = store.delete(keyToDelete);
          deleteRequest.onsuccess = () => {
            resolve();
          };
          deleteRequest.onerror = () => {
            const errorMsg = `Failed to delete local game data. Details: ${deleteRequest.error?.message || 'Unknown IndexedDB error'}`;
            console.error(`Error deleting from IndexedDB:`, deleteRequest.error);
            reject(new Error(errorMsg));
          };
        } else { 
          const errorMsg = `Attempted to delete a game save (key: ${keyToDelete}) not belonging to the local user.`;
          reject(new Error(errorMsg));
        }
      } else { 
        const errorMsg = `Game save not found for key: ${keyToDelete}. Cannot delete.`;
        reject(new Error(errorMsg));
      }
    };
    
    getRequest.onerror = () => {
      const errorMsg = `Failed to check local game (key: ${keyToDelete}) before deletion. Details: ${getRequest.error?.message || 'Unknown IndexedDB error'}`;
      console.error(`Error getting record before delete:`, getRequest.error);
      reject(new Error(errorMsg));
    };
  });
};

export const importGameToIndexedDB = async (
  gameDataToImport: Omit<SaveGameData, 'id' | 'timestamp'> & { name: string } // Ensure name is present
): Promise<string> => {
  const db = await getDb();
  
  const existingSaves = await loadGamesFromIndexedDB();
  const existingNames = existingSaves.map(s => s.name);

  let finalSaveName = gameDataToImport.name;
  let counter = 1;
  // Ensure unique name for imported save
  while (existingNames.includes(finalSaveName)) {
    finalSaveName = `${gameDataToImport.name} (${counter})`;
    counter++;
  }

  // The saveGameToIndexedDB function will handle the delta optimization logic.
  // The gameDataToImport should have full snapshots if it came from a standard JSON export.
  // If it came from an optimized (gzipped) export, its delta entries might already lack full snapshots.
  // saveGameToIndexedDB is designed to handle this: it derives deltas if snapshots are present and type is 'delta',
  // or preserves existing deltas if snapshots are missing but deltas are present.
  return saveGameToIndexedDB(
    gameDataToImport.knowledgeBase,
    gameDataToImport.gameMessages,
    finalSaveName,
    null // Always create as new save on import
  );
};


export const resetDBConnection = () => {
  dbPromise = null;
};

export const saveVector = async (data: { text: string, vector: number[], fileId: string }) => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VECTOR_STORE_NAME, 'readwrite');
    const store = tx.objectStore(VECTOR_STORE_NAME);
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getAllVectors = async () => {
  const db = await getDb();
  return new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction(VECTOR_STORE_NAME, 'readonly');
    const store = tx.objectStore(VECTOR_STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const clearAllVectors = async () => {
  const db = await getDb();
  
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([VECTOR_STORE_NAME, PALACE_STORE_NAME], 'readwrite');
    const vectorStore = tx.objectStore(VECTOR_STORE_NAME);
    const palaceStore = tx.objectStore(PALACE_STORE_NAME);
    
    vectorStore.clear();
    palaceStore.clear();
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error("Transaction aborted"));
  });
};

export const savePalace = async (palace: any) => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PALACE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PALACE_STORE_NAME);
    const request = store.put({ id: 'current_palace', ...palace });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getPalace = async () => {
  const db = await getDb();
  return new Promise<any>((resolve, reject) => {
    const tx = db.transaction(PALACE_STORE_NAME, 'readonly');
    const store = tx.objectStore(PALACE_STORE_NAME);
    const req = store.get('current_palace');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const deletePalace = async () => {
  const db = await getDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PALACE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PALACE_STORE_NAME);
    const req = store.delete('current_palace');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

/**
 * Dọn dẹp dữ liệu trùng lặp & thặng dư trong game saves để tối ưu hóa bộ nhớ
 */
export const optimizeGameSaveInIndexedDB = async (saveId: string): Promise<{ success: boolean; oldSize: number; newSize: number; message: string }> => {
  const db = await getDb();
  const transaction = db.transaction(SAVES_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(SAVES_STORE_NAME);

  const numericId = parseInt(saveId, 10);
  const keyToLoad = isNaN(numericId) ? saveId : numericId;

  return new Promise((resolve) => {
    const getRequest = store.get(keyToLoad);

    getRequest.onsuccess = () => {
      const data = getRequest.result as SaveGameData;
      if (!data) {
        resolve({ success: false, oldSize: 0, newSize: 0, message: "Không tìm thấy file lưu." });
        return;
      }

      let oldSize = 0;
      try {
        const sizeRelevantData = { kb: data.knowledgeBase, gm: data.gameMessages };
        oldSize = JSON.stringify(sizeRelevantData).length;
      } catch (e) {
        // Ignored
      }

      // 1. Dọn dẹp TurnHistory
      if (data.knowledgeBase && data.knowledgeBase.turnHistory) {
        data.knowledgeBase.turnHistory = data.knowledgeBase.turnHistory.map((entry: any) => ({
          turnNumber: entry.turnNumber,
          type: entry.type || 'delta'
        } as any));
      }

      // 2. Dọn dẹp ragVectorStore trùng lặp
      if (data.knowledgeBase && data.knowledgeBase.ragVectorStore && Array.isArray(data.knowledgeBase.ragVectorStore.metadata)) {
        const vectorStore = data.knowledgeBase.ragVectorStore;
        const uniqueMetadata: any[] = [];
        const uniqueVectors: number[][] = [];
        const seenKeys = new Set<string>();

        const length = vectorStore.metadata.length;
        for (let i = 0; i < length; i++) {
          const meta = vectorStore.metadata[i];
          const vector = vectorStore.vectors && vectorStore.vectors[i] ? vectorStore.vectors[i] : [];

          const textCleaned = (meta.text || '').trim();
          const key = `${meta.entityId}_${meta.entityType}_${textCleaned}`;

          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueMetadata.push(meta);
            const sanitizedVector = vector.map(num => Math.round(num * 10000) / 10000);
            uniqueVectors.push(sanitizedVector);
          }
        }

        data.knowledgeBase.ragVectorStore.metadata = uniqueMetadata;
        data.knowledgeBase.ragVectorStore.vectors = uniqueVectors;
      }

      // 3. Ghi đè lại bản ghi đã dọn dẹp
      data.timestamp = new Date();
      
      const putRequest = store.put(data);

      putRequest.onsuccess = () => {
        let newSize = 0;
        try {
          const sizeRelevantData = { kb: data.knowledgeBase, gm: data.gameMessages };
          newSize = JSON.stringify(sizeRelevantData).length;
        } catch (e) {
          // Ignored
        }
        resolve({
          success: true,
          oldSize,
          newSize,
          message: "Dọn dẹp thành công!"
        });
      };

      putRequest.onerror = () => {
        resolve({ success: false, oldSize, newSize: oldSize, message: "Lỗi khi lưu dữ liệu đã thu gọn." });
      };
    };

    getRequest.onerror = () => {
      resolve({ success: false, oldSize: 0, newSize: 0, message: "Không thể kết xuất dữ liệu lưu game." });
    };
  });
};

/**
 * Applies a bulk data mutation (JSON) to the database stores.
 * Used by the TAWA Storyteller engine for state-driven narrative.
 */
export const applyDataMutation = async (mutation: any, knowledgeBase: KnowledgeBase): Promise<KnowledgeBase> => {
    if (!mutation) return knowledgeBase;
    
    // In a real implementation, this would perform bulk updates to IndexedDB.
    // For this architecture, we update the in-memory KnowledgeBase which will be saved later.
    const updatedKb = JSON.parse(JSON.stringify(knowledgeBase)) as KnowledgeBase;
    
    // 1. Handle Stat Updates
    if (mutation.stat_updates && Array.isArray(mutation.stat_updates)) {
        mutation.stat_updates.forEach((update: any) => {
            const { name, operation, value } = update;
            const stats = updatedKb.playerStats as any;
            if (stats[name] !== undefined) {
                if (operation === 'add') stats[name] += value;
                else if (operation === 'subtract') stats[name] -= value;
                else if (operation === 'set') stats[name] = value;
            }
        });
    }
    
    // 2. Handle Inventory Updates
    if (mutation.inventory_updates) {
        const { add, remove } = mutation.inventory_updates;
        if (add && Array.isArray(add)) {
            add.forEach((item: any) => {
                updatedKb.inventory.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    ...item
                });
            });
        }
        if (remove && Array.isArray(remove)) {
            remove.forEach((rem: any) => {
                const index = updatedKb.inventory.findIndex(i => i.name === rem.name);
                if (index !== -1) updatedKb.inventory.splice(index, 1);
            });
        }
    }
    
    // 3. Handle NPC Updates
    if (mutation.npc_updates && Array.isArray(mutation.npc_updates)) {
        mutation.npc_updates.forEach((update: any) => {
            const npcIndex = updatedKb.discoveredNPCs.findIndex(n => n.name === update.name);
            if (npcIndex !== -1) {
                updatedKb.discoveredNPCs[npcIndex] = { ...updatedKb.discoveredNPCs[npcIndex], ...update };
            } else {
                updatedKb.discoveredNPCs.push({
                    id: Date.now().toString(),
                    affinity: 50,
                    ...update
                });
            }
        });
    }

    return updatedKb;
};
