import type TS from 'typescript'
import {ObservedChecker} from './observed-checker'
import {Helper, AccessNode, ts, Visiting, FlowInterruptionTypeMask} from '../../base'
import {ContextState} from './context-state'
import {ContextTypeMask} from './context-tree'
import {ContextVariables} from './context-variables'
import {ContextCapturer} from './context-capturer'
import {AccessReferences} from './access-references'


/** 
 * A source file, a method, or a namespace, a function, an arrow function
 * create a context.
 * Otherwise, a logic or flow statement will also create a context.
 */
export class Context {

	readonly type: number
	readonly visitingIndex: number
	readonly node: TS.Node
	readonly parent: Context | null
	readonly children: Context[] = []
	readonly state: ContextState
	readonly variables: ContextVariables
	readonly capturer: ContextCapturer

	/** 
	 * Self or closest ancestral context, which's type is function-like,
	 * or node is a source file.
	 */
	readonly closestFunctionLike: Context

	constructor(type: number, node: TS.Node, parent: Context | null) {
		this.type = type
		this.visitingIndex = Visiting.current.index
		this.node = node
		this.parent = parent
		this.state = new ContextState(this)
		this.variables = new ContextVariables(this)
		this.capturer = new ContextCapturer(this)

		this.closestFunctionLike = (type & ContextTypeMask.FunctionLike) || (type & ContextTypeMask.SourceFile)
			? this
			: parent!.closestFunctionLike

		if (parent) {
			parent.enterChild(this)
		}
	}

	/** 
	 * Call after children contexts are ready,
	 * and current context will exit.
	 */
	beforeExit() {
		this.capturer.beforeExit()

		if (this.parent) {
			this.parent.leaveChild(this)
		}
	}

	/** Enter a child context. */
	enterChild(child: Context) {
		this.children.push(child)
	}

	/** Leave a child context. */
	leaveChild(child: Context) {
		this.state.mergeChildContext(child)

		if (child.state.isFlowInterrupted()) {
			this.capturer.breakCaptured(child.visitingIndex, child.state.flowInterruptionType)
		}
	}

	/** 
	 * Visit context node and each descendant node inside current context.
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
		}

		// Test and add property access nodes.
		else if (Helper.access.isAccess(node)) {

			// `map.set`, `set.set`
			if (Helper.types.isMapOrSetWriting(node)) {
				this.mayAddSetTracking(node, true)
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
			for (let node of assignTo) {
				if (Helper.access.isAccess(node)) {
					this.mayAddSetTracking(node, false)
				}
				
				AccessReferences.visitAssignment(node)
			}
		}

		// Empty `return`.
		else if (ts.isReturnStatement(node) && !node.expression) {
			this.state.unionFlowInterruptionType(FlowInterruptionTypeMask.Return)
			this.capturer.breakCaptured(Visiting.current.index, FlowInterruptionTypeMask.Return)
		}

		// `break` or `continue`.
		else if (ts.isBreakOrContinueStatement(node)) {
			this.state.unionFlowInterruptionType(FlowInterruptionTypeMask.BreakLike)
			this.capturer.breakCaptured(Visiting.current.index, FlowInterruptionTypeMask.BreakLike)
		}
	}

	/** Add a property access expression. */
	private mayAddGetTracking(node: AccessNode) {
		if (this.state.nothingReturned) {
			return
		}

		if (!this.capturer.shouldCapture('get')) {
			return
		}

		if (ObservedChecker.isAccessingObserved(node)

			// `map.has`, and `map` get observed.
			|| Helper.types.isMapOrSetReading(node)
				&& ObservedChecker.isObserved(node.expression)
		) {
			this.capturer.capture(Visiting.getIndex(node), 'get')
		}
	}

	/** Add a property assignment expression. */
	private mayAddSetTracking(node: AccessNode, fromMapOrSet: boolean) {
		if (!this.capturer.shouldCapture('set')) {
			return
		}

		if (!fromMapOrSet && ObservedChecker.isAccessingObserved(node)
			|| fromMapOrSet && ObservedChecker.isObserved(node.expression)
		) {
			this.capturer.capture(Visiting.getIndex(node), 'set')
		}
	}
}
