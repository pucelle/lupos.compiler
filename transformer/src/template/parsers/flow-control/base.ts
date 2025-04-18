import type * as ts from 'typescript'
import {HTMLNode, HTMLNodeType, TemplateSlotPlaceholder} from '../../../lupos-ts-module'
import {TreeParser} from '../tree'
import {FlowControlSlotParser} from '../slots'
import {factory} from '../../../core'
import {TemplateParser} from '../template'


export abstract class FlowControlBase {

	readonly slot: FlowControlSlotParser
	readonly node: HTMLNode
	readonly tree: TreeParser
	readonly template: TemplateParser

	/** Whether output update content as a lazy callback. */
	readonly asLazyCallback: boolean = false

	constructor(slot: FlowControlSlotParser) {
		this.slot = slot
		this.node = slot.node
		this.tree = slot.tree
		this.template = slot.template
	}

	protected eatNext(...tagNames: string[]): HTMLNode[] {
		let node = this.node.nextSibling
		let eaten: HTMLNode[] = []

		while (node && node.type === HTMLNodeType.Tag) {
			if (tagNames.includes(node.tagName!)) {
				eaten.push(node)
				node = node.nextSibling
			}
			else {
				break
			}
		}

		for (let node of eaten) {
			node.remove()
		}
		
		return eaten
	}

	/** Returns whether has specified attribute name. */
	protected hasAttrValue(node: HTMLNode, name: string): boolean {
		return !!node.attrs?.find(attr => attr.name === name)
	}

	/** Get value index of slot `<lu:xx ${...}>`. */
	protected getAttrValueIndex(node: HTMLNode): number | null {
		let attrName = node.attrs?.find(attr => TemplateSlotPlaceholder.isCompleteSlotIndex(attr.name))?.name
		let index = attrName ? TemplateSlotPlaceholder.getUniqueSlotIndex(attrName) : null

		return index
	}

	/** Get value index of slot `<lu:xx>${...}<>`. */
	protected getUniqueChildValueIndex(node: HTMLNode): number | null {
		if (node.children.length === 0) {
			return null
		}

		let childNode = node.children.find(n => {
			return n.type === HTMLNodeType.Text
				&& TemplateSlotPlaceholder.isCompleteSlotIndex(n.text!.trim())
		})

		let index = childNode ? TemplateSlotPlaceholder.getUniqueSlotIndex(childNode.text!.trim()) : null

		return index
	}

	/** Make a maker array nodes by maker names. */
	protected outputMakerNodes(templateNames: (string | null)[]): ts.ArrayLiteralExpression {
		return factory.createArrayLiteralExpression(
			templateNames.map(name => this.outputMakerNode(name)),
			false
		)
	}

	/** Make a maker node by a maker name. */
	protected outputMakerNode(templateName: string | null): ts.Identifier | ts.NullLiteral {
		return templateName ? factory.createIdentifier(templateName) : factory.createNull()
	}

	preInit() {}
	postInit() {}
	outputInit(): ts.Statement | ts.Expression | (ts.Statement| ts.Expression)[] {
		return []
	}
	outputUpdate(): ts.Statement | ts.Expression | (ts.Statement| ts.Expression)[] {
		return []
	}
}