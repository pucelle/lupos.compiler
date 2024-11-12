import type TS from 'typescript'
import {Helper, ts, VisitTree} from '../../core'
import {TrackingScope} from './scope'


export enum TrackingScopeTypeMask {

	/** Source file. */
	SourceFile = 2 ** 0,

	/** Class range. */
	Class = 2 ** 1,

	/** 
	 * Function.
	 * Normally help to process parameters.
	 * or for ArrowFunction has no block-type body exist.
	 */
	FunctionLike = 2 ** 2,

	/** Function, but it should instantly run. */
	InstantlyRunFunction = 2 ** 3,

	/** `if`, or binary expressions like `a && b`, `a || b`, `a ?? b`. */
	Conditional = 2 ** 4,

	/** `if`, or binary expressions like `a && b`, `a || b`, `a ?? b`. */
	ConditionalCondition = 2 ** 5,

	/** 
	 * Condition of of `if`, `else`.
	 * Left part of binary expressions like `a && b`, `a || b`, `a ?? b`.
	 */
	ConditionalContent = 2 ** 6,

	/** `Switch`. */
	Switch = 2 ** 7,

	/** `Switch`. */
	SwitchCondition = 2 ** 8,

	/** `case` or `default`. */
	CaseDefault = 2 ** 9,

	/** Condition of `case` or `default`. */
	CaseCondition = 2 ** 10,

	/** Content of `case xxx ...`, `default ...`. */
	CaseDefaultContent = 2 ** 11,

	/** 
	 * Like content of `case xxx: ...`, `default ...`,
	 * or a specified range to contain partial of a template literal.
	 * A scope with `ContentRange` must have `rangeStartNode` and `rangeEndNode` nodes.
	 * And `node` is the container node contains both `rangeStartNode` and `rangeEndNode` nodes.
	 */
	ContentRange = 2 ** 12,

	/** Process For iteration initializer, condition, incrementor. */
	Iteration = 2 ** 13,

	/** `for (let...)` */
	IterationInitializer = 2 ** 14,

	/** `while (...)`, `for (; ...; )` */
	IterationCondition = 2 ** 15,

	/** `for (; ; ...)` */
	IterationIncreasement = 2 ** 16,

	/** `for (let xxx of ...)` */
	IterationExpression = 2 ** 17,

	/** 
	 * `while () ...`, `for () ...`, May run for none, 1 time, multiple times.
	 * Content itself can be a block, or a normal expression.
	 */
	IterationContent = 2 ** 18,

	/** `return`, `break`, `continue`, `yield `, `await`, and with content. */
	FlowInterruption = 2 ** 19,
}

/** Tracking scope and a visit index position. */
export interface TrackingScopeTargetPosition{
	scope: TrackingScope
	index: number
}


export namespace TrackingScopeTree {

	let stack: (TrackingScope | null)[] = []
	
	export let current: TrackingScope | null = null

	/** All content ranges. */
	let contentRanges: {start: TS.Node, end: TS.Node}[] = []

	/** Visit index -> scope. */
	const ScopeMap: Map<number, TrackingScope> = new Map()


	/** Initialize before visiting a new source file. */
	export function init() {
		stack = []
		current = null
		contentRanges = []
		ScopeMap.clear()
	}


	/** 
	 * Mark a node range, later will be made as a `ContentRange` scope.
	 * Note must mark before scope visitor visit it.
	 */
	export function markContentRange(startNode: TS.Node, endNode: TS.Node) {
		contentRanges.push({start: startNode, end: endNode})
	}

	/** Try get a content range by start node. */
	export function getContentRangeByStartNode(startNode: TS.Node): {start: TS.Node, end: TS.Node} | undefined {
		let range = contentRanges.find(r => r.start === startNode)
		return range
	}

	/** Remove a content range by start node. */
	export function removeContentRangeByStartNode(startNode: TS.Node) {
		let rangeIndex = contentRanges.findIndex(r => r.start === startNode)
		if (rangeIndex > -1) {
			contentRanges.splice(rangeIndex, 1)
		}
	}


	/** Check tracking scope type of a node. */
	export function checkType(node: TS.Node): TrackingScopeTypeMask | 0 {
		let parent = node.parent
		let type = 0

		// Source file
		if (ts.isSourceFile(node)) {
			type |= TrackingScopeTypeMask.SourceFile
		}

		// Class
		else if (ts.isClassLike(node)) {
			type |= TrackingScopeTypeMask.Class
		}

		// Function like
		else if (Helper.isFunctionLike(node)) {
			type |= TrackingScopeTypeMask.FunctionLike

			if (Helper.isInstantlyRunFunction(node)) {
				type |= TrackingScopeTypeMask.InstantlyRunFunction
			}
		}

		// For `if...else if...`
		else if (ts.isIfStatement(node)) {
			type |= TrackingScopeTypeMask.Conditional
		}

		// `a ? b : c`
		else if (ts.isConditionalExpression(node)) {
			type |= TrackingScopeTypeMask.Conditional
		}

		//  `a && b`, `a || b`, `a ?? b`
		else if (ts.isBinaryExpression(node)
			&& (
				node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
				|| node.operatorToken.kind === ts.SyntaxKind.BarBarToken
				|| node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
			)
		) {
			type |= TrackingScopeTypeMask.Conditional
		}

		// `switch(...) {...}`
		else if (ts.isSwitchStatement(node)) {
			type |= TrackingScopeTypeMask.Switch
		}

		// `case ...`, `default ...`.
		else if (ts.isCaseOrDefaultClause(node)) {
			type |= TrackingScopeTypeMask.CaseDefault
		}

		// Iteration
		else if (ts.isForOfStatement(node)
			|| ts.isForInStatement(node)
			|| ts.isForStatement(node)
			|| ts.isWhileStatement(node)
			|| ts.isDoStatement(node)
		) {
			type |= TrackingScopeTypeMask.Iteration
		}

		// Flow stop, and has content.
		// `break` and `continue` contains no expressions, so should not be a scope type.
		else if (Helper.pack.getFlowInterruptionType(node) > 0) {
			type |= TrackingScopeTypeMask.FlowInterruption
		}


		if (!parent) {
			return type
		}

		// `if (...) ...`
		if (ts.isIfStatement(parent)) {
			if (node === parent.expression) {
				type |= TrackingScopeTypeMask.ConditionalCondition
			}
			else if (node === parent.thenStatement || node === parent.elseStatement) {
				type |= TrackingScopeTypeMask.ConditionalContent
			}
		}

		// `a ? b : c`
		else if (ts.isConditionalExpression(parent)) {
			if (node === parent.condition) {
				type |= TrackingScopeTypeMask.ConditionalCondition
			}
			else if (node === parent.whenTrue || node === parent.whenFalse) {
				type |= TrackingScopeTypeMask.ConditionalContent
			}
		}

		// `a && b`, `a || b`, `a ?? b`.
		else if (ts.isBinaryExpression(parent)) {
			if ((parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
				|| parent.operatorToken.kind === ts.SyntaxKind.BarBarToken
				|| parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
			) {
				if (node === parent.left) {
					type |= TrackingScopeTypeMask.ConditionalCondition
				}
				else if (node === parent.right) {
					type |= TrackingScopeTypeMask.ConditionalContent
				}
			}
		}

		// `for (;;) ...`
		else if (ts.isForStatement(parent)) {
			if (node === parent.initializer) {
				type |= TrackingScopeTypeMask.IterationInitializer
			}
			else if (node === parent.condition) {
				type |= TrackingScopeTypeMask.IterationCondition
			}
			else if (node === parent.incrementor) {
				type |= TrackingScopeTypeMask.IterationIncreasement
			}
			else if (node === parent.statement) {
				type |= TrackingScopeTypeMask.IterationContent
			}
		}

		// `for ... in`, `for ... of`
		else if (ts.isForOfStatement(parent)
			|| ts.isForInStatement(parent)
		) {
			if (node === parent.initializer) {
				type |= TrackingScopeTypeMask.IterationInitializer
			}
			else if (node === parent.expression) {
				type |= TrackingScopeTypeMask.IterationExpression
			}
			else if (node === parent.statement) {
				type |= TrackingScopeTypeMask.IterationContent
			}
		}

		// `while ...`, `do ...`
		else if (ts.isWhileStatement(parent)
			|| ts.isDoStatement(parent)
		) {
			if (node === parent.expression) {
				type |= TrackingScopeTypeMask.IterationExpression
			}
			else if (node === parent.statement) {
				type |= TrackingScopeTypeMask.IterationContent
			}
		}

		// `switch (...) ...`
		else if (ts.isSwitchStatement(parent)) {
			if (node === parent.expression) {
				type |= TrackingScopeTypeMask.SwitchCondition
			}
		}

		// `case (...) ...`
		else if (ts.isCaseClause(parent)) {
			if (node === parent.expression) {
				type |= TrackingScopeTypeMask.CaseCondition
			}
		}

		return type
	}

	/** Check range content scope type of a node. */
	export function checkRangedType(node: TS.Node): TrackingScopeTypeMask | 0 {
		let parent = node.parent
		let type = 0

		// Make a content range.
		if (getContentRangeByStartNode(node)) {
			type |= TrackingScopeTypeMask.ContentRange

			// Content of case or default.
			if (ts.isCaseOrDefaultClause(parent)) {
				type |= TrackingScopeTypeMask.CaseDefaultContent
			}
		}

		return type
	}

	/** Create a scope from node and push to stack. */
	export function createScope(type: TrackingScopeTypeMask, node: TS.Node): TrackingScope {
		let index = VisitTree.getIndex(node)
		let startNode = null, endNode = null

		// Initialize content range.
		if (type & TrackingScopeTypeMask.ContentRange) {
			let range = getContentRangeByStartNode(node)
			if (range) {
				startNode = range.start
				endNode = range.end
			}
		}

		let scope = new TrackingScope(type, node, index, current, startNode, endNode)

		ScopeMap.set(index, scope)
		stack.push(current)

		// Child `case/default` statements start a content range.
		if (ts.isCaseOrDefaultClause(node)) {
			let statements = node.statements
			if (statements.length > 0) {
				markContentRange(statements[0], statements[statements.length - 1])
			}
		}

		return current = scope
	}

	/** Pop scope. */
	export function pop() {
		if (current && (current.type & TrackingScopeTypeMask.ContentRange)) {
			removeContentRangeByStartNode(current.rangeStartNode!)
		}

		current!.beforeExit()
		current = stack.pop()!
	}

	/** 
	 * Visit scope node and each descendant node within current scope.
	 * Recently all child scopes have been visited.
	 */
	export function visitNode(node: TS.Node) {
		if (current) {
			current.visitNode(node)
		}
	}


	/** Find closest scope contains or equals node with specified visit index. */
	export function findClosest(index: number): TrackingScope {
		let scope = ScopeMap.get(index)

		while (!scope) {
			index = VisitTree.getParentIndex(index)!
			scope = ScopeMap.get(index)
		}

		return scope
	}

	/** Find closest scope contains or equals node. */
	export function findClosestByNode(node: TS.Node): TrackingScope {
		return findClosest(VisitTree.getIndex(node))
	}

	/** 
	 * Walk scope itself and descendants.
	 * Always walk descendants before self.
	 */
	export function* walkInwardChildFirst(scope: TrackingScope, filter?: (scope: TrackingScope) => boolean): Iterable<TrackingScope> {
		if (!filter || filter(scope)) {
			for (let child of scope.children) {
				yield* walkInwardChildFirst(child, filter)
			}
	
			yield scope
		}
	}

	/** 
	 * Walk scope itself and descendants.
	 * Always walk descendants after self.
	 */
	export function* walkInwardSelfFirst(scope: TrackingScope, filter?: (scope: TrackingScope) => boolean): Iterable<TrackingScope> {
		if (!filter || filter(scope)) {
			yield scope
		
			for (let child of scope.children) {
				yield* walkInwardSelfFirst(child, filter)
			}
		}
	}


	/** 
	 * Find an ancestral index and scope, which can add statements to before it.
	 * If current position can add statements, return current position.
	 * Must before current position, and must not cross any conditional or iteration scope.
	 */
	export function findClosestPositionToAddStatements(index: number, from: TrackingScope): TrackingScopeTargetPosition {
		let scope = from
		let parameterIndex = VisitTree.findOutwardMatch(index, from.visitIndex, ts.isParameter)

		// Parameter initializer, no place to insert statements, returns position itself.
		if (parameterIndex !== undefined) {
			return {
				scope,
				index,
			}
		}

		let node = VisitTree.getNode(index)

		while (true) {

			// Can put statements ,
			// or can extend from `if()...` to `if(){...}`, insert before node.
			if (Helper.pack.canPutStatements(node)
				|| Helper.pack.canExtendToPutStatements(node)
			) {
				break
			}

			// `{...}`, insert before node.
			if (Helper.pack.canPutStatements(node.parent)) {

				// scope of node.parent.
				if (node === scope.node) {
					scope = scope.parent!
				}
				break
			}

			// To outer scope.
			if (node === scope.node) {
				
				// Can't across these types of scope, will end at the inner start of them.
				if (scope.type & TrackingScopeTypeMask.ConditionalContent
					|| scope.type & TrackingScopeTypeMask.IterationCondition
					|| scope.type & TrackingScopeTypeMask.IterationIncreasement
					|| scope.type & TrackingScopeTypeMask.IterationExpression
					|| scope.type & TrackingScopeTypeMask.IterationContent
				) {
					break
				}

				scope = scope.parent!
			}

			node = node.parent
		}

		return {
			scope,
			index: VisitTree.getIndex(node),
		}
	}
}