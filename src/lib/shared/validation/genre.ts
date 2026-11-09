import { z } from 'zod/v4';

export const GenreNameSchema = z
	.string()
	.trim()
	.min(1, { message: 'Genre name cannot be empty' })
	.max(100, { message: 'Genre name is too long' });

export const UpdateGenreSchema = z.object({
	id: z.uuidv4(),
	name: GenreNameSchema
});

export const DeleteGenreSchema = z.object({
	id: z.uuidv4()
});

export type GenreName = z.infer<typeof GenreNameSchema>;
export type UpdateGenre = z.infer<typeof UpdateGenreSchema>;
export type DeleteGenre = z.infer<typeof DeleteGenreSchema>;
