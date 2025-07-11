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

function calculateLevenshteinAndDiff(s1, s2) {
	const m = s1.length;
	const n = s2.length;

	const MAX_CHARS = 65535;

	if (m > MAX_CHARS || n > MAX_CHARS) {
		throw new Error(
			`入力テキストが長すぎます。各テキストは最大${MAX_CHARS}文字までです。現在の文字数: テキスト1=${m}文字, テキスト2=${n}文字。`,
		);
	}

	const totalDpSize = (m + 1) * (n + 1);
	const dp = new Uint16Array(totalDpSize);

	let lastProgressTime = Date.now();

	for (let k = 0; k < totalDpSize; k += 100) {
		dp.fill(0, k, k + 100);
		if (Date.now() - lastProgressTime > 50) {
			self.postMessage({
				type: "progress",
				text: `[2/4]メモリ確保中... (${k}/${totalDpSize}項目)`,
				value: (k / totalDpSize) * 0.2,
			});
			lastProgressTime = Date.now();
		}
	}

	function getIndex(row, col) {
		return row * (n + 1) + col;
	}

	for (let i = 0; i <= m; i++) {
		dp[getIndex(i, 0)] = i;
	}
	for (let j = 0; j <= n; j++) {
		dp[getIndex(0, j)] = j;
	}

	lastProgressTime = Date.now();
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			const cost = s1[i - 1] === s2[j - 1] ? 0 : 2;

			const valAbove = dp[getIndex(i - 1, j)] + 1;
			const valLeft = dp[getIndex(i, j - 1)] + 1;
			const valDiag = dp[getIndex(i - 1, j - 1)] + cost;

			dp[getIndex(i, j)] = Math.min(valAbove, valLeft, valDiag);
		}
		if (Date.now() - lastProgressTime > 20) {
			self.postMessage({
				type: "progress",
				text: `[3/4]編集距離計算中... (${getIndex(i + 1, 0)}/${totalDpSize}項目)`,
				value: 0.2 + (i / m) * 0.8,
			});
			lastProgressTime = Date.now();
		}
	}

	self.postMessage({
		type: "progress",
		text: `[4/4]結果準備中...`,
		value: 1,
	});

	const distance = dp[getIndex(m, n)];

	let html1 = "";
	let html2 = "";
	let i = m;
	let j = n;

	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && s1[i - 1] === s2[j - 1]) {
			html1 = escapeHtml(s1[i - 1]) + html1;
			html2 = escapeHtml(s2[j - 1]) + html2;
			i--;
			j--;
		} else if (
			j > 0 &&
			(i === 0 || dp[getIndex(i, j)] === dp[getIndex(i, j - 1)] + 1)
		) {
			html2 =
				`<span class="diff-added">${escapeHtml(s2[j - 1])}</span>` + html2;
			j--;
		} else if (
			i > 0 &&
			(j === 0 || dp[getIndex(i, j)] === dp[getIndex(i - 1, j)] + 1)
		) {
			html1 =
				`<span class="diff-removed">${escapeHtml(s1[i - 1])}</span>` + html1;
			i--;
		} else if (
			i > 0 &&
			j > 0 &&
			dp[getIndex(i, j)] === dp[getIndex(i - 1, j - 1)] + 2
		) {
			html1 =
				`<span class="diff-removed">${escapeHtml(s1[i - 1])}</span>` + html1;
			html2 =
				`<span class="diff-added">${escapeHtml(s2[j - 1])}</span>` + html2;
			i--;
			j--;
		} else {
			console.warn(
				"Unexpected path in diff reconstruction. Falling back to default step.",
			);
			if (i > 0) i--;
			else if (j > 0) j--;
		}
	}
	return { distance: distance, html1: html1, html2: html2 };
}

self.onmessage = function (e) {
	const { text1, text2 } = e.data;

	try {
		const { distance, html1, html2 } = calculateLevenshteinAndDiff(
			text1,
			text2,
		);
		self.postMessage({ type: "result", distance, html1, html2 });
	} catch (error) {
		self.postMessage({ type: "error", message: error.message });
	} finally {
		self.close();
	}
};
