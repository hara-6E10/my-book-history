
import { db, auth } from "./firebase.js";

import {
  collection,
  getDocs
} from "firebase/firestore";

import {
  onAuthStateChanged
} from "firebase/auth";

// ISBNからハイフンや空白を取り除く
function normalizeISBN(isbn) {
  return (isbn || "").replace(/[-\s]/g, "").toUpperCase();
}

// ISBN-10をISBN-13に変換する
function convertISBN10To13(isbn10) {
  const base = "978" + isbn10.substring(0, 9);
  let sum = 0;

  for (let i = 0; i < base.length; i++) {
    const number = Number(base[i]);
    sum += i % 2 === 0 ? number : number * 3;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return base + checkDigit;
}

// ISBNを13桁に統一する
function toISBN13(isbn) {
  const normalized = normalizeISBN(isbn);

  if (/^978\d{10}$|^979\d{10}$/.test(normalized)) {
    return normalized;
  }

  if (/^\d{9}[\dX]$/.test(normalized)) {
    return convertISBN10To13(normalized);
  }

  return null;
}

// Firebaseのログイン状態が確認できるまで待つ
const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => {
    resolve(user);
  });
});

// 図書館ページからの問い合わせを受け取る
chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {

    if (request.type !== "CHECK_BOOK_HISTORY") {
      return;
    }

    (async () => {
      // ログイン状態を確認
      const user = await authReady;

      if (!user) {
        return {
          success: false,
          message: "ログインしていません。"
        };
      }

      // Firestoreから本の一覧を取得
      const booksRef = collection(
        db,
        "users",
        user.uid,
        "books"
      );

      const snapshot = await getDocs(booksRef);

      const books = snapshot.docs.map(document => document.data());

      // ISBNが一致する本を探す
      const targetISBN = toISBN13(request.isbn);

      const foundBooks = books.filter(book =>
        toISBN13(book.isbn) === targetISBN
      );

      // 借りたことがない場合
      if (foundBooks.length === 0) {
        return {
          success: true,
          found: false
        };
      }

      // 貸出日が新しい順に並べる
      foundBooks.sort((a, b) =>
        (b.borrowDate || "").localeCompare(a.borrowDate || "")
      );

      return {
        success: true,
        found: true,
        count: foundBooks.length,
        latestBorrowDate: foundBooks[0].borrowDate
      };

    })()
      .then(sendResponse)
      .catch(error => {
        console.error("貸出履歴の検索に失敗しました:", error);

        sendResponse({
          success: false,
          message: "貸出履歴を検索できませんでした。"
        });
      });

    // 非同期処理の結果を待ってから返事をする
    return true;
  }
);
