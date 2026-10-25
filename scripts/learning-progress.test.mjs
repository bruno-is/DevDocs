import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(
	readFileSync(
		new URL("../src/scripts/learning-progress.ts", import.meta.url),
		"utf8",
	),
	{ compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;

function browser({ quota = false } = {}) {
	let stored = "[]";
	let inputs = [];
	const documentEvents = new Map();
	const windowEvents = new Map();
	const note = { textContent: "" };
	runInNewContext(source, {
		localStorage: {
			getItem: () => stored,
			setItem: (_key, value) => {
				if (quota) throw new Error("QuotaExceededError");
				stored = value;
			},
		},
		document: {
			addEventListener: (name, handler) => documentEvents.set(name, handler),
			querySelectorAll: (selector) =>
				selector === "[data-learning-complete]"
					? inputs
					: selector === "[data-learning-note]"
						? [note]
						: [],
		},
		window: {
			addEventListener: (name, handler) => windowEvents.set(name, handler),
		},
	});
	return {
		page(id) {
			const events = new Map();
			const checkbox = {
				dataset: { learningComplete: id },
				checked: false,
				addEventListener: (name, handler) => events.set(name, handler),
			};
			inputs = [checkbox];
			documentEvents.get("astro:page-load")();
			return {
				checkbox,
				check() {
					checkbox.checked = true;
					events.get("change")();
				},
			};
		},
		otherTab(ids) {
			stored = JSON.stringify(ids);
			windowEvents.get("storage")({ key: "devdocs:learning:v1" });
		},
		stored: () => JSON.parse(stored),
		note,
	};
}

test("preserva a marcação recebida de outra aba antes de gravar a atual", () => {
	const session = browser();
	const chapter = session.page("capitulo-a");
	session.otherTab(["capitulo-b"]);
	chapter.check();
	assert.deepEqual(session.stored().sort(), ["capitulo-a", "capitulo-b"]);
});

test("quota indisponível preserva progresso em memória entre navegações Astro", () => {
	const session = browser({ quota: true });
	session.page("capitulo-a").check();
	session.page("capitulo-b").check();
	assert.equal(session.page("capitulo-a").checkbox.checked, true);
	assert.equal(session.page("capitulo-b").checkbox.checked, true);
	assert.match(session.note.textContent, /somente esta sessão/);
	assert.deepEqual(session.stored(), []);
});
