import { sql, type SQL, type Column } from 'drizzle-orm';

// Returns true when the column is similar to the search, or when the search
// matches a word (or part of a word) inside the column.
export function trgmMatch(column: Column | SQL, search: string): SQL {
	return sql`(${column} % ${search} OR ${column} %> ${search})`;
}

// Returns float between 0 and 1
export function similarity(column: Column | SQL, search: string): SQL<number> {
	return sql<number>`similarity(${column}, ${search})`;
}

// Ggreat when query is a substring of column
export function wordSimilarity(search: string, column: Column | SQL): SQL<number> {
	return sql<number>`word_similarity(${search}, ${column})`;
}
