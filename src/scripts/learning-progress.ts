const key = "devdocs:learning:v1";
let session = new Set<string>();
let persistent = true;

function read(): Set<string> {
	if (!persistent) return session;
	try {
		const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
		session = new Set(
			Array.isArray(value)
				? value.filter((id): id is string => typeof id === "string")
				: [],
		);
		return session;
	} catch {
		persistent = false;
		return session;
	}
}

function render(completed: Set<string>): void {
	const cards = document.querySelectorAll<HTMLElement>("[data-learning-id]");
	let count = 0;
	for (const card of cards) {
		const done = completed.has(card.dataset.learningId ?? "");
		if (done) count++;
		const status = card.querySelector("[data-learning-status]");
		if (status) status.textContent = done ? "Estudado ✓" : "A estudar";
	}
	for (const checkbox of document.querySelectorAll<HTMLInputElement>(
		"[data-learning-complete]",
	))
		checkbox.checked = completed.has(checkbox.dataset.learningComplete ?? "");
	for (const summary of document.querySelectorAll("[data-learning-summary]"))
		summary.textContent = `${count} de ${cards.length} capítulos marcados como estudados`;
	if (!persistent)
		for (const note of document.querySelectorAll("[data-learning-note]"))
			note.textContent =
				"Armazenamento local indisponível. O progresso dura somente esta sessão.";
}

function init(): void {
	const completed = read();
	render(completed);
	for (const checkbox of document.querySelectorAll<HTMLInputElement>(
		"[data-learning-complete]",
	)) {
		checkbox.addEventListener("change", () => {
			const completed = read();
			const id = checkbox.dataset.learningComplete!;
			if (checkbox.checked) completed.add(id);
			else completed.delete(id);
			session = completed;
			try {
				localStorage.setItem(key, JSON.stringify([...completed]));
			} catch {
				persistent = false;
			}
			render(completed);
		});
	}
}
document.addEventListener("astro:page-load", init);
window.addEventListener("storage", (event) => {
	if (event.key === key || event.key === null) render(read());
});
