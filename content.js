// ISBNからハイフンを取り除く
function normalizeISBN(isbn) {
  return isbn.replace(/[-\s]/g, "").toUpperCase();
}

// ISBN-10をISBN-13に変換する
function convertISBN10To13(isbn10) {
  const isbn = normalizeISBN(isbn10);

  if (!/^\d{9}[\dX]$/.test(isbn)) {
    return null;
  }

  const base = "978" + isbn.substring(0, 9);
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


// 貸出履歴とISBNを照合する
async function checkBookHistory(isbn, message) {

  try {
    // background.js にISBNを送って検索を依頼する
    const result = await chrome.runtime.sendMessage({
      type: "CHECK_BOOK_HISTORY",
      isbn: isbn
    });

    // 検索に失敗した場合
    if (!result || !result.success) {
      message.textContent +=
        `\n⚠️ ${result?.message || "履歴を確認できませんでした。"}`;
      return;
    }

    // 過去に借りたことがある場合
    if (result.found) {
      message.textContent +=
        `\n📖 この本は過去に借りています！` +
        `\n📅 前回借りた日：${result.latestBorrowDate}` +
        `\n📚 借りた回数：${result.count}回`;

    } else {
      message.textContent +=
        "\n📖 この本はまだ借りていません。";
    }

  } catch (error) {
    console.error("貸出履歴の確認に失敗しました:", error);

    message.textContent +=
      "\n⚠️ 貸出履歴を確認できませんでした。";
  }
}



// メイン処理
async function main() {
  const pageText = document.body.innerText;

  const isbnMatch = pageText.match(
    /ISBN(?:13)?[\s：:]*([0-9Xx-]{10,17})/i
  );

  const message = document.createElement("div");

  message.style.padding = "16px 20px";
  message.style.margin = "16px";
  message.style.backgroundColor = "#f0f7fc";
  message.style.border = "1px solid #b8d8ef";
  message.style.borderLeft = "5px solid #4a90e2";
  message.style.borderRadius = "8px";
  message.style.fontSize = "15px";
  message.style.lineHeight = "1.8";
  message.style.color = "#333";
  message.style.whiteSpace = "pre-line";
  message.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.08)";  

  if (isbnMatch) {
    const isbn = toISBN13(isbnMatch[1]);

    if (isbn) {
      message.textContent = `📚 ISBN（照合用）：${isbn}`;
      await checkBookHistory(isbn, message);
    } else {
      message.textContent = "📚 ISBNの形式を確認できませんでした";
    }
  } else {
    message.textContent = "📚 ISBNが見つかりませんでした";
  }

  document.body.prepend(message);
}

main();
