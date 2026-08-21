export interface IAgilityContentItem {
	contentID: number;
	referenceName: string;
	values: {
		[key: string]: any;
	};

}

/**
 * Resolve the actual key used for a field in a content item's values, ignoring case.
 *
 * Agility returns field names using the casing defined in the content model, which
 * will not always match the casing we look for. Returns null when nothing matches.
 */
export function resolveFieldName(values: Record<string, any> | null | undefined, fieldName: string): string | null {
	if (!values) return null
	if (fieldName in values) return fieldName

	const target = fieldName.toLowerCase()
	return Object.keys(values).find((key) => key.toLowerCase() === target) || null
}

/**
 * Read a field from a content item's values, ignoring the case of the field name.
 */
export function getFieldValue(values: Record<string, any> | null | undefined, fieldName: string): any {
	if (!values) return undefined

	const key = resolveFieldName(values, fieldName)
	return key === null ? undefined : values[key]
}
