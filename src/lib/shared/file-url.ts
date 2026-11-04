/** Self-hosted file route for an owned file id. */
export function fileSrc(fileId: string): string {
	return `/files/${fileId}`;
}

export function coverSrc(book: { coverFileId?: string | null }): string | null {
	return book.coverFileId ? fileSrc(book.coverFileId) : null;
}

export function receiptSrc(order: { receiptFileId?: string | null }): string | null {
	return order.receiptFileId ? fileSrc(order.receiptFileId) : null;
}
