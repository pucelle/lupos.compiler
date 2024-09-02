import type TS from 'typescript'
import {ts} from './global'


export namespace TemplateSlotPlaceholder {

	/** 
	 * Get whole string part of a tagged template.
	 * Template slots have been replaced to placeholder `$LUPOS_SLOT_INDEX_\d$`.
	 */
	export function toTemplateString(tem: TS.TaggedTemplateExpression): string {
		let template = tem.template
		if (ts.isNoSubstitutionTemplateLiteral(template)) {
			return template.text
		}
		else if (ts.isTemplateExpression(template)) {
			let string = template.head.text
			let index = -1
			
			for (let span of template.templateSpans) {
				string += `\$LUPOS_SLOT_INDEX_${++index}\$`
				string += span.literal.text
			}

			return string
		}
		else {
			return ''
		}
	}

	/** Replace placeholder `$LUPOS_SLOT_INDEX_\d_ with a replacer. */
	export function replaceTemplateString(
		string: string,
		replacer: (index: number) => string
	): string {
		return string.replace(/\$LUPOS_SLOT_INDEX_(\d+)\$/, (_m0, m1) => {
			return replacer(Number(m1))
		})
	}


	/** Extract all expression interpolations from a template. */
	export function extractTemplateValues(tem: TS.TaggedTemplateExpression): TS.Expression[] {
		let template = tem.template
		let values: TS.Expression[] = []

		if (!ts.isTemplateExpression(template)) {
			return values
		}

		for (let span of template.templateSpans) {
			values.push(span.expression)
		}

		return values
	}

	/** 
	 * Split a full template string by template slot placeholder `$LUPOS_SLOT_INDEX_\d_.
	 * If `quoted`, must return a string list.
	 */
	export function parseTemplateStrings(parsed: string, quoted: boolean = false): string[] | null {
		let result = parsed.split(/\$LUPOS_SLOT_INDEX_\d+\$/g)
		if (result.length === 2 && result[0] === '' && result[1] === '' && !quoted) {
			return null
		}

		return result
	}


	/** Whether string has a template slot placeholder `$LUPOS_SLOT_INDEX_\d_. */
	export function hasSlotIndex(string: string): boolean {
		return /\$LUPOS_SLOT_INDEX_\d+\$/.test(string)
	}


	/** Whether string is a complete template slot placeholder `$LUPOS_SLOT_INDEX_\d_. */
	export function isCompleteSlotIndex(string: string): boolean {
		return /^\$LUPOS_SLOT_INDEX_\d+\$$/.test(string)
	}


	/** Get slot index from placeholder `$LUPOS_SLOT_INDEX_\d_. */
	export function getUniqueSlotIndex(string: string): number | null {
		return Number(string.match(/^\$LUPOS_SLOT_INDEX_(\d+)\$$/)?.[1] ?? null)
	}


	/** 
	 * Get all slot indices from a string containing some template slot placeholders `$LUPOS_SLOT_INDEX_\d_.
	 * Returns `null` if no index.
	 */
	export function getSlotIndices(string: string): number[] | null {
		let indices = [...string.matchAll(/\$LUPOS_SLOT_INDEX_(\d+)\$/g)].map(m => Number(m[1]))
		return indices.length > 0 ? indices : null
	}


	/** Whether tag name represents named component. */
	export function isNamedComponent(tagName: string): boolean {
		return /^[A-Z]/.test(tagName)
	}


	/** Whether tag name represents dynamic component. */
	export function isDynamicComponent(tagName: string): boolean {
		return isCompleteSlotIndex(tagName)
	}


	/** Whether tag name represents named component or dynamic component. */
	export function isComponent(tagName: string): boolean {
		return isNamedComponent(tagName) || isDynamicComponent(tagName)
	}
}