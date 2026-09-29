import type { RemoteFormIssue } from '@sveltejs/kit';

export function formatIssueLines(
	issues: RemoteFormIssue[] | undefined,
	arrayKey: string,
	fieldLabels: Record<string, () => string>,
	rowLabel: (row: number) => string
): string[] {
	return (issues ?? []).map((issue) => {
		const [, rowIndex, field] = issue.path;
		if (issue.path[0] === arrayKey && typeof rowIndex === 'number' && typeof field === 'string') {
			const row = rowLabel(rowIndex + 1);
			const label = fieldLabels[field]?.();
			return label ? `${row} · ${label}: ${issue.message}` : `${row}: ${issue.message}`;
		}
		return issue.message;
	});
}
