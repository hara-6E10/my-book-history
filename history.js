import { db, auth } from "./firebase.js";

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc
} from "firebase/firestore";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

const STORAGE_KEY = "libraryBooks";
let editingId = null;
let searchKeyword = "";

// ログイン中のユーザー専用の保存場所を取得する
function getBooksCollection() {
  const user = auth.currentUser;
  return collection(db, "users", user.uid, "books");
}

// ローカル保存データをFirestoreへ移行する
async function migrateLocalBooks() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const localBooks = result[STORAGE_KEY] || [];

  for (let i = 0; i < localBooks.length; i++) {
    const book = localBooks[i];
    const migrationId = `legacy_${i}`;

    const bookRef = doc(
      db,
      "users",
      auth.currentUser.uid,
      "books",
      migrationId
    );

    // 同じIDの本が既にあれば上書きしない
    const existingBook = await getDoc(bookRef);

    if (!existingBook.exists()) {
      await setDoc(bookRef, {
        title: book.title,
        isbn: book.isbn || "",
        borrowDate: book.borrowDate,
        memo: book.memo || ""
      });
    }
  }

  // 移行完了の印をつける
  await chrome.storage.local.set({
    libraryBooksMigratedToFirestore: true
  });
}

// Firestoreから本を読み込む
async function loadBooks() {
  const snapshot = await getDocs(getBooksCollection());

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data()
  }));
}

// 編集する本の情報をフォームに読み込む
async function loadEditBook() {

  // URLから本のIDを取得する
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  // IDがなければ新規登録なので終了
  if (!id) {
    return;
  }

  // Firestoreから本の一覧を取得
  const books = await loadBooks();

  // IDが一致する本を探す
  const book = books.find((book) => book.id === id);

  // 該当する本が見つからない場合
  if (!book) {
    alert("編集する本が見つかりませんでした。");
    window.location.href = "history.html";
    return;
  }

  // 編集対象のIDを保存
  editingId = book.id;

  // フォームに本の情報をセット
  document.getElementById("title").value = book.title;
  document.getElementById("isbn").value = book.isbn || "";
  document.getElementById("borrowDate").value = book.borrowDate;
  document.getElementById("memo").value = book.memo || "";

  // 登録ボタンの表示を変更
  document.querySelector("#book-form button[type='submit']").textContent =
    "変更を保存する";

  // 編集キャンセルボタンを表示
  showCancelButton();
}

// 編集をキャンセルする
function cancelEdit() {
  window.location.href = "history.html";
}

// 編集キャンセルボタンを用意する
function showCancelButton() {
  if (document.getElementById("cancel-edit")) {
    return;
  }

  const cancelButton = document.createElement("button");
  cancelButton.id = "cancel-edit";
  cancelButton.type = "button";
  cancelButton.textContent = "編集をキャンセル";

  cancelButton.addEventListener("click", cancelEdit);

  document.getElementById("book-form").appendChild(cancelButton);
}


// 本の一覧と貸出冊数を表示する
async function displayBooks() {
  const books = await loadBooks();

  // 検索キーワードで絞り込む
  const filteredBooks = books.filter((book) => {
    const keyword = searchKeyword.toLowerCase();

    return (
      (book.title || "").toLowerCase().includes(keyword) ||
      (book.author || "").toLowerCase().includes(keyword)
    );
  });

  // 借りた日が新しい順に並べ替える
  filteredBooks.sort((a, b) =>
    (b.borrowDate || "").localeCompare(a.borrowDate || "")
  );

  const bookList = document.getElementById("book-list");
  bookList.replaceChildren();


  

  filteredBooks.forEach((book) => {
    // 1冊分のカードを作成
    const item = document.createElement("li");

    // 書籍タイトル
    const title = document.createElement("div");
    title.className = "book-title";
    title.textContent = book.title;

    item.appendChild(title);

    // 書籍情報
    const info = [
      `著者：${book.author || "未登録"}`,
      `ISBN：${book.isbn || "未登録"}`,
      `貸出日：${book.borrowDate || "未登録"}`
    ];

    info.forEach((text) => {
      const paragraph = document.createElement("p");
      paragraph.className = "book-info";
      paragraph.textContent = text;
      item.appendChild(paragraph);
    });

    // メモを表示 
    const memo = document.createElement("p");
    memo.className = "book-info";
    memo.textContent = `メモ：${book.memo || "なし"}`;
    item.appendChild(memo);

    // ボタンをまとめる場所
    const actions = document.createElement("div");
    actions.className = "book-actions";

    // 編集ボタン
const editButton = document.createElement("button");
editButton.type = "button";
editButton.textContent = "編集";
editButton.className = "book-edit";

editButton.addEventListener("click", () => {
  window.location.href =
    "register.html?id=" + encodeURIComponent(book.id);
});

    // 削除ボタン
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.className = "book-delete";

    deleteButton.addEventListener("click", async () => {
      if (!confirm("この本の履歴を削除しますか？")) {
        return;
      }

      await deleteDoc(
        doc(db, "users", auth.currentUser.uid, "books", book.id)
      );

      await displayBooks();
    });

    // ボタンをまとめる
    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    item.appendChild(actions);
    bookList.appendChild(item);
  });
}

// 検索窓の処理
const searchInput = document.getElementById("search-input");

if (searchInput) {
  searchInput.addEventListener("input", () => {
    searchKeyword = searchInput.value.trim();
    displayBooks();
  });
}


// ログインフォームの処理
const loginForm = document.getElementById("login-form");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("login-error");

    errorMessage.textContent = "";

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("ログインに失敗しました:", error);
      errorMessage.textContent =
        "ログインできませんでした。メールアドレスとパスワードを確認してください。";
    }
  });
}

// ログアウトボタンの処理
const logoutButton = document.getElementById("logout-button");

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("ログアウトに失敗しました:", error);
      alert("ログアウトできませんでした。");
    }
  });
}
// 登録・編集フォームの処理
const bookForm = document.getElementById("book-form");

if (bookForm) {
  bookForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = document.getElementById("title").value.trim();
    const author = document.getElementById("author").value.trim();
    const isbn = document.getElementById("isbn").value.replace(/[-\s]/g, "");
    const borrowDate = document.getElementById("borrowDate").value;
    const memo = document.getElementById("memo").value;
    

    if (!title || !borrowDate) {
      alert("書名と貸出日を入力してください。");
      return;
    }

    const book = { title, author, isbn, borrowDate, memo };

    try {
      if (editingId === null) {
        await addDoc(getBooksCollection(), book);
      } else {
        await updateDoc(
          doc(db, "users", auth.currentUser.uid, "books", editingId),
          book
        );
      }

      // 保存が終わったら一覧ページへ戻る
      window.location.href = "history.html";

    } catch (error) {
      console.error("保存に失敗しました:", error);
      alert("本の保存に失敗しました。コンソールを確認してください。");
    }
  });
}

// ログイン状態を監視する
onAuthStateChanged(auth, async (user) => {
  const loginPanel = document.getElementById("login-panel");
  const bookPanel = document.getElementById("book-panel");
  const listPanel = document.getElementById("list-panel");
  const logoutArea = document.getElementById("logout-area");

  // ログインしていない場合
  if (!user) {
    if (loginPanel) {
      loginPanel.hidden = false;
    }

    if (bookPanel) {
      bookPanel.hidden = true;
    }

    if (listPanel) {
      listPanel.hidden = true;
    }

    if (logoutArea) {
      logoutArea.hidden = true;
    }

    // 登録ページを開いていて未ログインなら一覧ページへ戻す
    if (!loginPanel) {
      window.location.href = "history.html";
    }

    return;
  }

  // ログインしている場合
  if (loginPanel) {
    loginPanel.hidden = true;
  }

  if (bookPanel) {
    bookPanel.hidden = false;
  }

  if (listPanel) {
    listPanel.hidden = false;
  }

  if (logoutArea) {
    logoutArea.hidden = false;
  }

  try {
    await migrateLocalBooks();
  
    // 本の一覧があるページなら一覧を表示
    if (listPanel) {
      await displayBooks();
    }
  
    // 登録フォームがあるページなら編集データを読み込む
    if (bookPanel) {
      await loadEditBook();
    }
  
  } catch (error) {
    console.error("データの読み込みに失敗しました:", error);
    alert("データの読み込みに失敗しました。コンソールを確認してください。");
  }
});
