import type TS from 'typescript'
import {AccessNode, factory, Helper, Modifier, ts} from '../../core'
import {groupBy} from '../../utils'


export namespace AccessGrouper {

	/** 
	 * Add get or set tracking imports.
	 * Not add when making expressions automatically because it's outputting already.
	 */
	export function addImport(type: 'get' | 'set') {
		Modifier.addImport(type === 'get' ? 'trackGet' : 'trackSet', '@pucelle/ff')
	}
	

	/** Group expressions to lately insert a position. */
	export function makeExpressions(nodes: AccessNode[], type: 'get' | 'set'): TS.Expression[] {
		nodes = nodes.map(node => Helper.pack.normalize(node, true) as AccessNode)

		let grouped = groupExpressions(nodes)
		let made = grouped.map(item => createGroupedExpression(item, type))

		return made
	}

	
	/** Group get expressions by property belonged to object. */
	function groupExpressions(nodes: AccessNode[]): AccessNode[][] {
		let group = groupBy(nodes, (node: AccessNode) => {
			return [getExpressionKey(node), node]
		})

		return [...group.values()]
	}


	/** Make a key by a property accessing node. */
	function getExpressionKey(node: AccessNode) {
		let exp = node.expression
		let key = Helper.getFullText(exp).trim()

		if (node.questionDotToken) {
			key += '?.'
		}

		return key
	}


	/** Create a `trackGet` or `trackSet` call. */
	function createGroupedExpression(nodes: AccessNode[], type: 'get' | 'set'): TS.Expression {
		let node = nodes[0]
		let parameters = createNameParameter(nodes)
		
		let trackGet = factory.createCallExpression(
			factory.createIdentifier(type === 'get' ? 'trackGet' : 'trackSet'),
			undefined,
			parameters
		)

		// `a?.b` -> `a && trackGet(a, 'b')`
		if (node.questionDotToken) {
			return factory.createBinaryExpression(
				Helper.pack.removeAccessComments(node.expression),
				factory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
				trackGet
			)
		}
		else {
			return trackGet
		}
	}


	/** Create a parameter for `trackGet` or `trackSet` by a group of nodes. */
	function createNameParameter(nodes: AccessNode[]): TS.Expression[] {
		let node = nodes[0]
		let group = groupNameExpressionKeys(nodes)
		let nameExps = [...group.values()].map(nodes => getAccessNodeNameProperty(nodes[0]))

		return [
			Helper.pack.removeAccessComments(node.expression),
			...nameExps,
		]
	}


	/** Get all expression keys, repetitive keys are excluded. */
	function groupNameExpressionKeys(items: AccessNode[]): Map<string, AccessNode[]> {
		return groupBy(items, item => [getNameKey(item), item])
	}


	/** Get a name expression key. */
	function getNameKey(item: AccessNode): string {
		let name = getAccessNodeNameProperty(item)
		
		// 'name' -> "name"
		if (ts.isStringLiteral(name)) {
			return `"${name.text}"`
		}

		return Helper.getFullText(name)
	}


	/** Get name of property expression. */
	function getAccessNodeNameProperty(node: AccessNode): TS.Expression {
		let name: TS.Expression

		if (ts.isPropertyAccessExpression(node)) {
			name = factory.createStringLiteral(Helper.getFullText(node.name))
		}
		else {
			name = Helper.pack.removeAccessComments(node.argumentExpression)
		}

		return name
	}
}