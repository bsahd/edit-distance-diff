function escapeHtml(text) {
	const map = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#039;",
	};
	return text.replace(/[&<>"']/g, function (m) {
		return map[m];
	});
}

function callWorker(text1, text2) {
	const worker = new Worker("worker.js");
	worker.postMessage({ text1, text2 });
	return new Promise((resolve, reject) => {
		worker.onmessage = function (e) {
			if (e.data.type === "progress") {
				document.getElementById("progressContainer").innerHTML =
					`<progress value="${e.data.value}" max="1"></progress>${e.data.text}`;
			} else if (e.data.type === "result") {
				resolve([e.data.distance, e.data.html1, e.data.html2]);
				worker.terminate();
			} else if (e.data.type === "error") {
				reject(new Error(e.data.message));
				worker.terminate();
			}
		};
		worker.onerror = function (err) {
			reject(new Error("Workerエラーが発生しました: " + err.message));
			worker.terminate();
		};
	});
}

function updateResultsDisplay(
	charDist,
	diffHtml1,
	diffHtml2,
	calculationTimeMs,
	error,
) {
	const resultsContainer = document.getElementById("resultsContainer");
	let content = "";

	if (error) {
		content = `<div class="error-message">${escapeHtml(error)}</div>`;
	} else {
		content = `
                    <div class="result-container">
                        <div class="result-box">
                            <h2>計算結果</h2>
                            <p><strong>文字ベースの編集距離:</strong> ${charDist !== null ? charDist : "計算できませんでした"}</p>
                            <p><strong>計算時間:</strong> ${calculationTimeMs !== null && calculationTimeMs !== undefined ? calculationTimeMs.toFixed(2) + " ms" : "---"}</p>
                        </div>
                        <div class="diff-section">
                            <h2>差分表示</h2>
                            <div class="diff-flex-container">
                                <div class="diff-pane">
                                    <h3>テキスト1</h3>
                                    <pre class="diff-output">${diffHtml1 || ""}</pre>
                                </div>
                                <div class="diff-pane">
                                    <h3>テキスト2</h3>
                                    <pre class="diff-output">${diffHtml2 || ""}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
	}
	resultsContainer.innerHTML = content;
}

const text1Input = document.getElementById("text1");
const text2Input = document.getElementById("text2");
const text1Stat = document.getElementById("text1stat");
const text2Stat = document.getElementById("text2stat");
const textStat = document.getElementById("textstat");
const submitButton = document.getElementById("submitButton");
const resultsContainer = document.getElementById("resultsContainer");
const diffForm = document.getElementById("diffForm");

const MAX_CHARS = 65535;

function updateStats() {
	const len1 = text1Input.value.length;
	const len2 = text2Input.value.length;
	text1Stat.textContent = `${len1}/${MAX_CHARS}文字`;
	text2Stat.textContent = `${len2}/${MAX_CHARS}文字`;

	const tableSize = (len1 + 1) * (len2 + 1);
	const memoryMiB = ((tableSize * 2) / 1024 / 1024).toFixed(3);

	textStat.textContent = `テーブルサイズ: ${tableSize} 項目 ( ${memoryMiB} MiB )`;
}

text1Input.addEventListener("input", updateStats);
text2Input.addEventListener("input", updateStats);
window.addEventListener("load", updateStats);

diffForm.addEventListener("submit", async function (event) {
	event.preventDefault();

	const text1 = text1Input.value;
	const text2 = text2Input.value;

	if (text1.length > MAX_CHARS || text2.length > MAX_CHARS) {
		updateResultsDisplay(
			null,
			null,
			null,
			null,
			`入力テキストが長すぎます。各テキストは最大${MAX_CHARS}文字までです。`,
		);
		return;
	}

	text1Input.readOnly = true;
	text2Input.readOnly = true;
	submitButton.disabled = true;

	document.getElementById("progressContainer").innerHTML =
		`<div class="indeterminate-progress-bar"></div>[1/4]ワーカー起動中...`;
	document.documentElement.classList.add("loading");

	let charDist = null;
	let diffHtml1 = "";
	let diffHtml2 = "";
	let calculationTimeMs = null;
	let error = null;

	try {
		const startTime = performance.now();

		[charDist, diffHtml1, diffHtml2] = await callWorker(text1, text2);

		const endTime = performance.now();
		calculationTimeMs = endTime - startTime;
	} catch (e) {
		console.error("Calculation error:", e);
		if (e instanceof Error) {
			error = `計算中にエラーが発生しました: ${e.message}`;
		} else {
			error = `計算中に不明なエラーが発生しました: ${e}`;
		}
	} finally {
		updateResultsDisplay(
			charDist,
			diffHtml1,
			diffHtml2,
			calculationTimeMs,
			error,
		);
		document.documentElement.classList.remove("loading");

		text1Input.readOnly = false;
		text2Input.readOnly = false;
		submitButton.disabled = false;
		document.getElementById("progressContainer").innerHTML = "";
	}
});
