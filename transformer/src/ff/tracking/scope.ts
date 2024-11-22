import type TS from 'typescript'
import {ObservedChecker} from './observed-checker'
import {Helper, AccessNode, ts, FlowInterruptionTypeMask, ScopeTree} from '../../core'
import {TrackingScopeState} from './scope-state'
import {TrackingScopeTypeMask} from './scope-tree'
import {TrackingScopeVariables} from './scope-variables'
import {TrackingCapturer} from './capturer'
import {AccessReferences} from './access-references'
import {ForceTrackType, TrackingPatch} from './patch'
import {CapturedOutputWay, TrackingRange} from './ranges'


/** 
 * A source file, a method, or a namespace, a function, an arrow function
 * initialize a tracking scope.
 * Otherwise, a logic or a flow statement will also initialize a tracking scope.
 */
export class TrackingScope {

	readonly type: TrackingScopeTypeMask
	readonly visitIndex: number
	readonly node: TS.Node
	readonly parent: TrackingScope | null
	readonly range: TrackingRange | null
	readonly children: TrackingScope[] = []
	readonly state: TrackingScopeState
	readonly variables: TrackingScopeVariables
	readonly capturer: TrackingCapturer

	/** 
	 * Self or closest ancestral scope, which's type is function-like,
	 * and should normally non-instantly run.
	 */
	readonly closestNonInstantlyRunFunction: TrackingScope | null

	constructor(
		type: TrackingScopeTypeMask,
		rawNode: TS.Node,
		index: number,
		parent: TrackingScope | null,
		range: TrackingRange | null
	) {
		this.type = type
		this.visitIndex = index
		this.node = rawNode
		this.parent = parent
		this.range = range

		this.state = new TrackingScopeState(this)
		this.variables = new TrackingScopeVariables(this)
		this.capturer = new TrackingCapturer(this, this.state, range?.outputWay ?? CapturedOutputWay.FollowNode)

		let beNonInstantlyRunFunction = (type & TrackingScopeTypeMask.FunctionLike)
			&& (type & TrackingScopeTypeMask.InstantlyRunFunction) === 0
		
		this.closestNonInstantlyRunFunction = beNonInstantlyRunFunction
			? this
			: parent?.closestNonInstantlyRunFunction ?? null

		if (parent) {
			parent.enterChild(this)
		}
	}

	/** 
	 * Get declaration scope for putting declarations.
	 * For function scope, it returns the scope of function body.
	 * Note it's not tracking scope.
	 */
	getDeclarationScope() {
		if (Helper.isFunctionLike(this.node) && this.node.body) {
			return ScopeTree.findClosestByNode(this.node.body)
		}
		else {
			return ScopeTree.findClosestByNode(this.node)
		}
	}

	/** 
	 * Call after children scopes are ready,
	 * and current scope will exit.
	 */
	beforeExit() {
		this.capturer.beforeExit()

		if (this.parent) {
			this.parent.leaveChild(this)
		}
	}

	/** Enter a child scope. */
	enterChild(child: TrackingScope) {
		this.children.push(child)
	}

	/** Leave a child scope. */
	leaveChild(child: TrackingScope) {
		this.state.mergeChildScope(child)

		if (child.state.isFlowInterrupted()) {
			this.capturer.breakCaptured(child.visitIndex, child.state.flowInterruptionType)
		}
	}

	/** 
	 * Visit scope node and each descendant node inside current scope.
	 * When visiting a node, child nodes of this node have visited.
	 */
	visitNode(node: TS.Node) {

		// Add parameters.
		if (ts.isParameter(node)) {
			this.variables.visitParameter(node)
		}

		// Check each variable declarations.
		else if (ts.isVariableDeclaration(node)) {
			this.variables.visitVariable(node)

			// let {a} = b
			if (node.initializer) {
				let names = Helper.variable.walkDeclarationNames(node)

				for (let {node: nameNode, keys} of names) {
					this.mayAddGetTracking(nameNode, node.initializer, keys)
				}
			}
		}

		// Test and add property access nodes.
		else if (Helper.access.isAccess(node)) {

			// `[].push`, `map.set`, `set.set`
			if (ObservedChecker.isListStructWriteAccess(node)) {
				this.mayAddSetTracking(node)
			}

			// `a.b`
			else {
				this.mayAddGetTracking(node)
			}

			AccessReferences.visitAssess(node)
		}

		// Test and add property assignment nodes.
		else if (Helper.assign.isAssignment(node)) {
			let assignTo = Helper.assign.getToExpressions(node)
			
			for (let to of assignTo) {
				if (Helper.access.isAccess(to)) {
					this.mayAddSetTracking(to)
				}
			}
		}

		// Empty `return`.
		else if (ts.isReturnStatement(node) && !node.expression) {
			this.state.unionFlowInterruptionType(FlowInterruptionTypeMask.Return)
			this.capturer.breakCaptured(this.visitIndex, FlowInterruptionTypeMask.Return)
		}

		// `break` or `continue`.
		else if (ts.isBreakOrContinueStatement(node)) {
			this.state.unionFlowInterruptionType(FlowInterruptionTypeMask.BreakLike)
			this.capturer.breakCaptured(this.visitIndex, FlowInterruptionTypeMask.BreakLike)
		}
	}

	/** Add a property access expression. */
	private mayAddGetTracking(node: AccessNode | TS.Identifier, exp?: TS.Expression, keys?: (string | number)[]) {
		if (this.state.shouldIgnoreGetTracking(node)) {
			return
		}

		if (!this.capturer.shouldCapture('get')) {
			return
		}

		// Normal tracking.
		if (ObservedChecker.isObserved(node)) {
			this.capturer.capture(node, exp, keys, 'get')
		}

		// Force tracking.
		let type = TrackingPatch.getForceTrackType(node)
		if (type === ForceTrackType.Elements) {
			this.capturer.capture(node, node as TS.Expression, [''], 'get')
		}
	}

	/** Add a property assignment expression. */
	private mayAddSetTracking(node: AccessNode | TS.Identifier, exp?: TS.Expression, keys?: (string | number)[]) {
		if (this.state.shouldIgnoreSetTracking(node)) {
			return
		}

		if (!this.capturer.shouldCapture('set')) {
			return
		}

		if (ObservedChecker.isObserved(node)) {
			this.capturer.capture(node, exp, keys, 'set')
		}
	}
}