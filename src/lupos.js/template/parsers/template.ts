import type TS from 'typescript'
import {HTMLNode, HTMLTree} from '../html-syntax'
import {TreeParser} from './tree'
import {TemplateValues} from './template-values'
import {factory, Scope, Scoping} from '../../../base'


export type TemplateType = 'html' | 'svg'


/**
 * Parse template string value expressions,
 * it will add a parsed to a TemplateMaker instance and add it to source file,
 * and return a expression to replace original template node.
 */
export class TemplateParser {

	readonly type: TemplateType
	readonly values: TemplateValues
	readonly rawNode: TS.TaggedTemplateExpression
	readonly scope: Scope

	private readonly treeParsers: TreeParser[] = []

	constructor(type: TemplateType, string: string, values: TS.Expression[], rawNode: TS.TaggedTemplateExpression) {
		this.type = type
		this.values = new TemplateValues(values, this)
		this.rawNode = rawNode
		this.scope = Scoping.findClosestScopeOfNode(rawNode)

		let tree = HTMLTree.fromString(string)
		this.addTreeParser(tree, null, null)
	}

	/** Add a tree and parent. */
	addTreeParser(tree: HTMLTree, parent: TreeParser | null, fromNode: HTMLNode | null): TreeParser {
		let parser = new TreeParser(this, tree, parent, fromNode)
		
		this.treeParsers.push(parser)
		parser.init()
		
		return parser
	}

	/** Create a template element with `html` as content. */
	createTemplateFromHTML(html: string) {
		let template = document.createElement('template')
		template.innerHTML = html

		return template
	}

	/** 
	 * Output whole template compiled,
	 * and returns a expression to replace original template literal.
	 */
	output(): TS.Expression {
		for (let treeParser of this.treeParsers) {
			treeParser.output()
		}

		let mainTreeParser = this.treeParsers[0]
		let makerName = mainTreeParser.getTemplateRefName()
		let valuesNodes = this.values.output()

		return factory.createNewExpression(
			factory.createIdentifier('CompiledTemplateResult'),
			undefined,
			[
				factory.createIdentifier(makerName),
				valuesNodes
			]
		)	
	}
}
