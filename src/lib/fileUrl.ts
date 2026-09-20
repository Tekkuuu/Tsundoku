/** Self-hosted file route for an owned file id. */
export function fileSrc(fileId: string): string {
	return `/files/${fileId}`;
}

/**
 * Resolve what to render for a cover/receipt: a self-hosted file wins,
 * otherwise fall back to a legacy external URL, otherwise nothing.
 */
export function storedFileSrc(
	fileId: string | null | undefined,
	externalUrl: string | null | undefined
): string | null {
	if (fileId) return fileSrc(fileId);
	const trimmed = externalUrl?.trim();
	return trimmed ? trimmed : null;
}

export function coverSrc(book: { coverFileId?: string | null }): string | null {
	return book.coverFileId ? fileSrc(book.coverFileId) : null;
}

export function receiptSrc(order: {
	receiptFileId?: string | null;
	receiptUrl?: string | null;
}): string | null {
	return storedFileSrc(order.receiptFileId, order.receiptUrl);
}
