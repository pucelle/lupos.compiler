import * as ts from 'typescript'
import {HTMLNode, HTMLRoot, PositionMapper} from '../../lupos-ts-module'
import {TreeParser} from './tree'
import {TemplateValues} from './template-values'
import {factory, Modifier, VariableScope, VariableScopeTree, VisitTree} from '../../core'


export type TemplateType = 'html' | 'svg'


/**
 * Parse template string value expressions,
 * it will add a parsed to a TemplateMaker instance and add it to source file,
 * and return a expression to replace original template node.
 */
export class TemplateParser {

	readonly type: TemplateType
	readonly root: HTMLRoot

	/** All value nodes even for sub template. */
	readonly values: TemplateValues

	/** Raw template node even for sub template. */
	readonly node: ts.Node

	/** Map node position to ts source file position. */
	readonly positionMapper: PositionMapper

	private readonly treeParsers: TreeParser[] = []
	private readonly subTemplates: TemplateParser[] = []

	/** Which scope should insert contents. */
	private innerMostScope: VariableScope = VariableScopeTree.getTopmost()

	constructor(type: TemplateType, root: HTMLRoot, valueNodes: ts.Expression[], rawNode: ts.Node, positionMapper: PositionMapper) {
		this.type = type
		this.root = root
		this.node = rawNode
		this.positionMapper = positionMapper

		let tree = this.addTreeParser(root, null, null)
		this.values = new TemplateValues(valueNodes, tree)

		/** Initialize after values ready. */
		tree.parse()
	}

	/** Add a root and parent tree parser. */
	addTreeParser(root: HTMLRoot, parent: TreeParser | null, fromNode: HTMLNode | null): TreeParser {
		let tree = new TreeParser(this, root, parent, fromNode)
		this.treeParsers.push(tree)
		return tree
	}

	/** 
	 * Separate children of a node to an independent sub template,
	 * it uses it's own value list.
	 * */
	separateChildrenAsTemplate(node: HTMLNode): TemplateParser {
		let root = HTMLRoot.fromSeparatingChildren(node)
		let template = new TemplateParser(this.type, root, this.values.valueNodes, this.node, this.positionMapper)
		this.subTemplates.push(template)

		return template
	}
	
	/** 
	 * Add a referenced declaration node, normally component or binding class declaration.
	 * If a template uses a local component,
	 * then generated codes can't be appended to topmost scope.
	 */
	addRefedDeclaration(node: ts.Node) {
		let scope = VariableScopeTree.findClosest(node)
		if (!scope) {
			return
		}

		// Pick scope with larger depth.
		if (VisitTree.isPrecedingOf(this.innerMostScope.node, scope.node)) {
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
	outputReplaced(): ts.Expression {
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
