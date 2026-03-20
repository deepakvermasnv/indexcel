import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';

function userSheetsCollection(userId) {
  return collection(db, 'users', userId, 'sheets');
}

function userSheetDoc(userId, sheetId) {
  return doc(db, 'users', userId, 'sheets', sheetId);
}

export async function fetchSheets(userId) {
  const sheetsQuery = query(userSheetsCollection(userId), orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(sheetsQuery);

  return snapshot.docs.map((sheetDoc) => ({
    id: sheetDoc.id,
    ...sheetDoc.data(),
  }));
}

export async function fetchSheet(userId, sheetId) {
  const snapshot = await getDoc(userSheetDoc(userId, sheetId));

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function saveSheet(userId, sheet) {
  const sheetRef = userSheetDoc(userId, sheet.id);
  const existingSheet = await getDoc(sheetRef);

  await setDoc(
    sheetRef,
    {
      name: sheet.name,
      data: sheet.data,
      createdAt: existingSheet.exists() ? existingSheet.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
