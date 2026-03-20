import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { fetchSheets, saveSheet } from '../lib/firestoreSheets';

const LOCAL_STORAGE_ACTIVE_SHEET_KEY = 'activeSheetId';
const LOCAL_STORAGE_SHEETS_KEY = 'sheets';
const SAVE_DEBOUNCE_MS = 1000;

function buildDefaultSheet() {
  return {
    id: crypto.randomUUID(),
    name: 'Sheet 1',
    data: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function useFirestoreSheets() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sheets, setSheets] = useState([]);
  const [activeSheetId, setActiveSheetId] = useState(null);
  const lastSavedSheetRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  const activeSheet = useMemo(
    () => sheets.find((sheet) => sheet.id === activeSheetId) ?? null,
    [sheets, activeSheetId]
  );

  const persistLocalState = useCallback((nextSheets, nextActiveSheetId) => {
    localStorage.setItem(LOCAL_STORAGE_SHEETS_KEY, JSON.stringify(nextSheets));
    localStorage.setItem(LOCAL_STORAGE_ACTIVE_SHEET_KEY, nextActiveSheetId ?? '');
  }, []);

  const replaceSheets = useCallback((nextSheets, nextActiveSheetId) => {
    setSheets(nextSheets);
    setActiveSheetId(nextActiveSheetId);
    persistLocalState(nextSheets, nextActiveSheetId);
  }, [persistLocalState]);

  const createSheet = useCallback(() => {
    const nextSheet = buildDefaultSheet();
    const nextSheets = [...sheets, nextSheet];

    replaceSheets(nextSheets, nextSheet.id);
  }, [replaceSheets, sheets]);

  const switchSheet = useCallback((sheetId) => {
    setActiveSheetId(sheetId);
    localStorage.setItem(LOCAL_STORAGE_ACTIVE_SHEET_KEY, sheetId);
  }, []);

  const renameSheet = useCallback((sheetId, name) => {
    setSheets((currentSheets) => {
      const nextSheets = currentSheets.map((sheet) => (
        sheet.id === sheetId
          ? { ...sheet, name, updatedAt: new Date().toISOString() }
          : sheet
      ));

      persistLocalState(nextSheets, activeSheetId);
      return nextSheets;
    });
  }, [activeSheetId, persistLocalState]);

  const updateCell = useCallback((rowId, columnId, value) => {
    setSheets((currentSheets) => {
      const nextSheets = currentSheets.map((sheet) => {
        if (sheet.id !== activeSheetId) {
          return sheet;
        }

        return {
          ...sheet,
          data: {
            ...sheet.data,
            [`${rowId}:${columnId}`]: value,
          },
          updatedAt: new Date().toISOString(),
        };
      });

      persistLocalState(nextSheets, activeSheetId);
      return nextSheets;
    });
  }, [activeSheetId, persistLocalState]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        const localSheets = JSON.parse(localStorage.getItem(LOCAL_STORAGE_SHEETS_KEY) || '[]');
        const localActiveSheetId = localStorage.getItem(LOCAL_STORAGE_ACTIVE_SHEET_KEY);
        const fallbackSheets = localSheets.length > 0 ? localSheets : [buildDefaultSheet()];
        const fallbackActiveSheetId = localActiveSheetId || fallbackSheets[0].id;

        setUser(null);
        replaceSheets(fallbackSheets, fallbackActiveSheetId);
        setIsLoading(false);
        return;
      }

      setUser({ userId: firebaseUser.uid, email: firebaseUser.email });

      const remoteSheets = await fetchSheets(firebaseUser.uid);
      const nextSheets = remoteSheets.length > 0 ? remoteSheets : [buildDefaultSheet()];
      const persistedActiveSheetId = localStorage.getItem(LOCAL_STORAGE_ACTIVE_SHEET_KEY);
      const fallbackActiveSheetId = nextSheets.some((sheet) => sheet.id === persistedActiveSheetId)
        ? persistedActiveSheetId
        : nextSheets[0].id;

      replaceSheets(nextSheets, fallbackActiveSheetId);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [replaceSheets]);

  useEffect(() => {
    if (!user?.userId || !activeSheet) {
      return undefined;
    }

    const serializedSheet = JSON.stringify(activeSheet);
    if (serializedSheet === lastSavedSheetRef.current) {
      return undefined;
    }

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await saveSheet(user.userId, activeSheet);
      lastSavedSheetRef.current = serializedSheet;
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(saveTimeoutRef.current);
  }, [activeSheet, user]);

  return {
    user,
    isLoading,
    sheets,
    activeSheetId,
    activeSheet,
    createSheet,
    switchSheet,
    renameSheet,
    updateCell,
  };
}
