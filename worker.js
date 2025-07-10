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

	const dp = Array(m + 1)
		.fill(0)
		.map(() => Array(n + 1).fill(0));

	for (let i = 0; i <= m; i++) {
		dp[i][0] = i;
	}
	for (let j = 0; j <= n; j++) {
		dp[0][j] = j;
	}

	let lastProgressTime = Date.now();
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			const cost = s1[i - 1] === s2[j - 1] ? 0 : 2;

			dp[i][j] = Math.min(
				dp[i - 1][j] + 1,
				dp[i][j - 1] + 1,
				dp[i - 1][j - 1] + cost,
			);
		}
		if (Date.now() - lastProgressTime > 20) {
			self.postMessage({
				type: "progress",
				text: `編集距離計算中... (${i}/${m}文字)`,
				value: i / m,
			});
			lastProgressTime = Date.now();
		}
	}

	const distance = dp[m][n];

	let html1 = "";
	let html2 = "";
	let i = m;
	let j = n;

	lastProgressTime = Date.now();
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && s1[i - 1] === s2[j - 1]) {
			html1 = escapeHtml(s1[i - 1]) + html1;
			html2 = escapeHtml(s2[j - 1]) + html2;
			i--;
			j--;
		} else if (j > 0 && (i === 0 || dp[i][j] === dp[i][j - 1] + 1)) {
			html2 =
				`<span class="diff-added">${escapeHtml(s2[j - 1])}</span>` + html2;
			j--;
		} else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
			html1 =
				`<span class="diff-removed">${escapeHtml(s1[i - 1])}</span>` + html1;
			i--;
		} else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 2) {
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

	const { distance, html1, html2 } = calculateLevenshteinAndDiff(text1, text2);

	self.postMessage({ type: "result", distance, html1, html2 });

	self.close();
};
