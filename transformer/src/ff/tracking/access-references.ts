import {AccessNode, factory, Helper, InterpolationContentType, Interpolator, Modifier, transformContext, ts, VisitTree, ScopeTree} from '../../core'
import type TS from 'typescript'
import {TrackingScopeTree} from './scope-tree'
import {TrackingScope} from './scope'


/** 
 * It helps to remember all references,
 * and replace an access node to reference if needed.
 */
export namespace AccessReferences {

	/** 
	 * Remember visit indices that have been visited.
	 * 
	 * E.g., for access node `a.b.c`,
	 * Will visit `a.b.c`, and make reference item `a` -> index of `a.b`.
	 * Later will visit `a.b` and make reference item `a` -> index of `a`.
	 * If we assign to `a`, both `a.b` and `a` will be referenced.
	 * 
	 * By avoid visiting a node twice, will only reference `a`.
	 */
	const VisitedNodes: Set<TS.Node> = new Set()

	/** 
	 * If access as `a.b`, and later assign `a`, then node `a` of `a.b` become mutable.
	 * Node visit index -> Assignment visit index.
	 */
	const WillBeAssignedIndices: Map<number, number> = new Map()

	/** Indices where access nodes have been referenced. */
	const ReferencedIndices: Set<number> = new Set()

	/** Node visit indices that have tested reference. */
	const ReferencedTested: Set<number> = new Set()


	/** Initialize after enter a new source file. */
	export function init() {
		VisitedNodes.clear()
		WillBeAssignedIndices.clear()
		ReferencedIndices.clear()
		ReferencedTested.clear()
	}


	/** Whether any descendant access node has been referenced. */
	export function hasExternalAccessReferenced(index: number, ignoreListStructKey: boolean): boolean {
		if (ReferencedIndices.has(index)) {
			return true
		}

		let node = VisitTree.getNode(index)

		if (ignoreListStructKey
			&& Helper.access.isAccess(node)
			&& Helper.isListStruct(node.expression)
		) {
			return hasExternalAccessReferenced(VisitTree.getIndex(node.expression), false)
		}

		let childIndices = VisitTree.getChildIndices(index)
		if (!childIndices) {
			return false
		}

		return childIndices.some(i => hasExternalAccessReferenced(i, false))
	}


	/** Visit an assess node, and it may make several reference items. */
	export function visitAssess(node: AccessNode) {
		let expIndex = VisitTree.getIndex(node.expression)!
		let nameNode = Helper.access.getPropertyNode(node)
		let nameIndex = VisitTree.getIndex(nameNode)

		visitAssessVisitor(node.expression, expIndex)
		visitAssessVisitor(nameNode, nameIndex)
	}

	/** 
	 * Visit all descendant nodes of an access node,
	 * and build a map of all the referenced variables/accessing, to current node.
	 * Later, when one of these nodes assigned, we will reference this access node.
	 */
	function visitAssessVisitor(node: TS.Node, topIndex: number): TS.Node {
		if (VisitedNodes.has(node)) {
			return node
		}

		VisitedNodes.add(node)

		// `a?.b` has been replaced to `a.b`
		if (Helper.access.isAccess(node) || Helper.isVariableIdentifier(node)) {
			let assignIndex = ScopeTree.whereWillBeAssigned(node)
			if (assignIndex !== undefined) {
				WillBeAssignedIndices.set(topIndex, assignIndex)
			}
		}

		return ts.visitEachChild(node, (n: TS.Node) => visitAssessVisitor(n, topIndex), transformContext)
	}


	/** Visit an assess node, reference after determined should reference. */
	export function mayReferenceAccess(index: number, toIndex: number, scope: TrackingScope) {
		let node = VisitTree.getNode(index)
		if (!Helper.access.isAccess(node)) {
			return
		}

		// Avoid after tested, move to outer and test again.
		if (ReferencedTested.has(index)) {
			return
		}

		let expIndex = VisitTree.getIndex(node.expression)!
		let nameNode = Helper.access.getPropertyNode(node)
		let nameIndex = VisitTree.getIndex(nameNode)

		// Use a reference variable to replace expression.
		if (shouldReference(expIndex, toIndex)) {
			reference(expIndex, scope)
			ReferencedIndices.add(expIndex)
		}

		// Use a reference variable to replace name.
		if (shouldReference(nameIndex, toIndex)) {
			reference(nameIndex, scope)
			ReferencedIndices.add(nameIndex)
		}

		ReferencedTested.add(index)
	}


	/** 
	 * After an node visiting has been marked as mutable,
	 * and before output it's tracking codes,
	 * test whether it should output as mutable.
	 */
	function shouldReference(index: number, toIndex: number): boolean {
		let node = VisitTree.getNode(index)
		if (shouldReferenceInternal(node)) {
			return true
		}

		if (!WillBeAssignedIndices.has(index)) {
			return false
		}

		// Mutable when output after assignment
		let assignmentIndex = WillBeAssignedIndices.get(index)!
		return VisitTree.isPrecedingOfInChildFirstOrder(assignmentIndex, toIndex)
	}
	

	/** 
	 * Whether be a complex expression like binary, and should be referenced.
	 * `a().b` -> `var $ref_; ...; $ref_ = a(); $ref_.b`
	 * or `a[i++]` -> `var _ref; ... ; $ref_ = i++; a[_ref]`
	 */
	function shouldReferenceInternal(node: TS.Node): boolean {

		// `a && b`, `a || b`, `a ?? b`, `a + b`, `a, b`.
		if (ts.isBinaryExpression(node)) {
			return true
		}

		// `a++`, `++a`.
		if (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) {
			return true
		}

		// `(...)`
		else if (ts.isParenthesizedExpression(node)) {
			return shouldReferenceInternal(node.expression)
		}

		// `(a as Observed<{b: number}>).b`
		else if (ts.isAsExpression(node)) {
			return shouldReferenceInternal(node.expression)
		}

		// `a ? b : c`
		else if (ts.isConditionalExpression(node)) {
			return true
		}

		// `a.b()`
		else if (ts.isCallExpression(node)) {
			return true
		}

		else {
			return false
		}
	}


	/** 
	 * Reference a complex expression to become a reference variable.
	 * 
	 * e.g.:
	 * 	   `a.b().c`-> `$ref_0 = a.b(); ... $ref_`
	 *     `a[b++]` -> `$ref_0 = b++; ... a[$ref_0]`
	 */
	function reference(index: number, scope: TrackingScope) {
		let varDeclListIndex = VisitTree.findOutwardMatch(index, scope.visitIndex, ts.isVariableDeclaration)
		let varScope = ScopeTree.findClosest(index).findClosestToAddStatements()
		let refName = varScope.makeUniqueVariable('$ref_')

		// Insert one variable declaration to existing declaration list: `var ... $ref_0 = ...`
		if (varDeclListIndex !== undefined) {
			
			// insert `var $ref_0 = a.b()` to found position.
			Modifier.addVariableAssignmentToList(index, varDeclListIndex, refName)

			// replace `a.b()` -> `$ref_0`.
			Interpolator.replace(index, InterpolationContentType.Reference, () => factory.createIdentifier(refName))
		}

		// Insert two: `var $ref_0`, and `$ref_0 = ...`
		else {
			
			let refPosition = TrackingScopeTree.findClosestPositionToAddStatements(index, scope)
			let declAssignTogether = varScope.node === refPosition.scope.node

			if (declAssignTogether) {

				// insert `let $ref_0 = a.b()` to found position.
				Modifier.addVariableAssignment(index, refPosition.index, refName)
			}
			else {
				// let $ref_0 
				varScope.addVariable(refName)
				
				// insert `$ref_0 = a.b()` to found position.
				Modifier.addReferenceAssignment(index, refPosition.index, refName)
			}

			// replace `a.b()` -> `$ref_0`.
			Interpolator.replace(index, InterpolationContentType.Reference, () => factory.createIdentifier(refName))
		}
	}
}