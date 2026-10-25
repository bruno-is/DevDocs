import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";
import { validateLearningGraph } from "../src/lib/learning.ts";

const doc = (id, order, prerequisites = [], tech = "sistemas") => ({
	id,
	data: { order, tech, learning: { prerequisites } },
});

test("aceita um grafo com dependências anteriores e biblioteca sem metadados", () => {
	assert.doesNotThrow(() =>
		validateLearningGraph([
			doc("a", 10),
			doc("b", 20, ["a"]),
			{ id: "php", data: { order: 10, tech: "php" } },
		]),
	);
});
test("rejeita pré-requisito ausente ou de outra formação", () => {
	assert.throws(() => validateLearningGraph([doc("b", 20, ["a"])]), /inválido/);
	assert.throws(
		() =>
			validateLearningGraph([doc("a", 10, [], "outro"), doc("b", 20, ["a"])]),
		/inválido/,
	);
});
test("rejeita ciclos, autodependência, duplicatas e ordem ambígua", () => {
	assert.throws(
		() => validateLearningGraph([doc("a", 10, ["b"]), doc("b", 20, ["a"])]),
		/cíclico/,
	);
	assert.throws(() => validateLearningGraph([doc("a", 10, ["a"])]), /cíclico/);
	assert.throws(
		() => validateLearningGraph([doc("a", 10), doc("b", 10)]),
		/duplicada/,
	);
	assert.throws(
		() => validateLearningGraph([doc("a", 10), doc("b", 20, ["a", "a"])]),
		/duplicado/,
	);
	assert.throws(
		() => validateLearningGraph([doc("a", 10), doc("a", 20)]),
		/duplicados/,
	);
});
test("exige metadados da formação e valida o currículo publicado e referências cruzadas", () => {
	assert.throws(
		() =>
			validateLearningGraph([
				{ id: "a", data: { tech: "sistemas", order: 10 } },
			]),
		/ausentes/,
	);
	const files = readdirSync(
		new URL("../src/content/docs/", import.meta.url),
	).filter((file) => file.endsWith(".yaml"));
	const docs = files.map((file) => ({
		id: file.slice(0, -5),
		data: parse(
			readFileSync(
				new URL(`../src/content/docs/${file}`, import.meta.url),
				"utf8",
			),
		),
	}));
	validateLearningGraph(docs);
	const byId = new Map(docs.map((entry) => [entry.id, entry]));
	const chapters = docs.filter((entry) => entry.data.tech === "sistemas");
	assert(chapters.length > 0, "formação deve conter unidades de estudo");
	assert.equal(
		chapters.filter((entry) => entry.data.learning?.kind === "orientation")
			.length,
		1,
		"formação deve ter uma orientação",
	);
	for (const entry of chapters) {
		assert.equal(entry.data.id, entry.id);
		assert.equal(entry.data.readerLayout, "narrative");
		const ids = entry.data.sections.map((section) => section.id);
		assert.equal(
			new Set(ids).size,
			ids.length,
			`âncoras duplicadas: ${entry.id}`,
		);
		assert(
			ids.every((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)),
			`âncora instável: ${entry.id}`,
		);
		let exercises = 0;
		let sources = 0;
		for (const section of entry.data.sections)
			for (const item of section.entries)
				for (const block of item.contentBlocks ?? []) {
					if (block.type === "exercise") {
						exercises++;
						assert(block.answer && block.rubric?.length);
					}
					if (block.type === "sources") {
						sources++;
						for (const source of block.items)
							assert.equal(new URL(source.url).protocol, "https:");
					}
					if (block.type === "reference-card")
						for (const link of block.links ?? []) {
							const target = byId.get(link.doc);
							assert(target, `${entry.id} → ${link.doc}`);
							if (link.section)
								assert(
									target.data.sections.some((s) => s.id === link.section),
									`${entry.id} → ${link.doc}#${link.section}`,
								);
						}
				}
		assert(exercises > 0, `exercícios ausentes: ${entry.id}`);
		assert(sources > 0, `fontes ausentes: ${entry.id}`);
	}
});
