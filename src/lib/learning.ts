/** Validação pura, compartilhada pelo build e pelos testes do currículo. */
export interface LearningDocument {
	id: string;
	data: {
		tech: string;
		order: number;
		learning?: { prerequisites: string[] };
	};
}

export function validateLearningGraph(docs: LearningDocument[]): void {
	const byId = new Map(docs.map((doc) => [doc.id, doc]));
	if (byId.size !== docs.length)
		throw new Error("IDs de documentos duplicados");
	const orders = new Set<string>();
	for (const doc of docs) {
		if (doc.data.tech === "sistemas" && !doc.data.learning) {
			throw new Error(`Metadados de estudo ausentes: ${doc.id}`);
		}
		if (!doc.data.learning) continue;
		const orderKey = `${doc.data.tech}:${doc.data.order}`;
		if (orders.has(orderKey))
			throw new Error(`Ordem de estudo duplicada: ${orderKey}`);
		orders.add(orderKey);
		const prerequisites = doc.data.learning.prerequisites;
		if (new Set(prerequisites).size !== prerequisites.length)
			throw new Error(`Pré-requisito duplicado: ${doc.id}`);
		for (const id of prerequisites) {
			const target = byId.get(id);
			if (!target?.data.learning || target.data.tech !== doc.data.tech)
				throw new Error(`Pré-requisito inválido: ${doc.id} → ${id}`);
			if (target.data.order >= doc.data.order)
				throw new Error(
					`Pré-requisito fora de ordem ou cíclico: ${doc.id} → ${id}`,
				);
		}
	}
}
