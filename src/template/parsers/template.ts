import type TS from 'typescript'
import {HTMLNode, HTMLRoot} from '../html-syntax'
import {TreeParser} from './tree'
import {TemplateValues} from './template-values'
import {factory, Modifier, Scope, ScopeTree} from '../../base'


export type TemplateType = 'html' | 'svg'


/**
 * Parse template string value expressions,
 * it will add a parsed to a TemplateMaker instance and add it to source file,
 * and return a expression to replace original template node.
 */
export class TemplateParser {

	readonly type: TemplateType
	readonly values: TemplateValues
	readonly rawNode: TS.Node

	private readonly treeParsers: TreeParser[] = []
	private readonly subTemplates: TemplateParser[] = []

	/** Which scope should insert contents. */
	private innerMostScope: Scope = ScopeTree.getTopmost()

	constructor(type: TemplateType, root: HTMLRoot, values: TS.Expression[], rawNode: TS.Node) {
		this.type = type
		this.values = new TemplateValues(values)
		this.rawNode = rawNode
		this.addTreeParser(root, null, null)
	}

	/** Add a root and parent tree parser. */
	addTreeParser(root: HTMLRoot, parent: TreeParser | null, fromNode: HTMLNode | null): TreeParser {
		let parser = new TreeParser(this, root, parent, fromNode)
		
		this.treeParsers.push(parser)
		parser.init()
		
		return parser
	}

	/** 
	 * Separate children of a node to an independent sub template,
	 * it uses it's own value list.
	 * */
	separateChildrenAsTemplate(node: HTMLNode): TemplateParser {
		let root = HTMLRoot.fromSeparatingChildren(node)
		let template = new TemplateParser(this.type, root, this.values.rawValueNodes, this.rawNode)
		this.subTemplates.push(template)

		return template
	}
	
	/** 
	 * Add a referenced declaration node, normally component or binding class declaration.
	 * If a template uses a local component,
	 * then generated codes can't be appended to topmost scope.
	 */
	addRefedDeclaration(node: TS.Node) {
		let scope = ScopeTree.findClosestByNode(node)
		if (!scope) {
			return
		}

		// Pick scope with larger depth.
		// One must contain another, so only need to compare visit index.
		if (this.innerMostScope.visitIndex < scope.visitIndex) {
			this.innerMostScope = scope
		}
	}

	/** 
	 * Output whole template compiled contents, and sub templates.
	 * Return a callback, call which will finally interpolate to source file.
	 * 
	 * Split it to two steps because it initialize self then children,
	 * but we want to output children firstly, then self.
	 */
	prepareToOutputCompiled(): () => void {
		Modifier.addImport('CompiledTemplateResult', '@pucelle/lupos.js')
		
		let outputSub: (() => void)[] = []
		let outputSelf: (() => void)[] = []

		// Sub templates prepare earlier, but output later.
		for (let template of this.subTemplates) {
			outputSub.push(template.prepareToOutputCompiled())
		}

		// Self contents prepare later, but output earlier.
		for (let treeParser of this.treeParsers) {
			outputSelf.push(treeParser.prepareToOutput(this.innerMostScope))
		}

		return () => {
			for (let output of outputSelf) {
				output()
			}

			for (let output of outputSub) {
				output()
			}
		}
	}

	/** 
	 * Returns a expression to replace original template literal.
	 * Must after `outputCompiled`.
	 */
	outputReplaced(): TS.Expression {
		let mainTreeParser = this.treeParsers[0]
		let makerName = mainTreeParser.makeTemplateRefName()
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
