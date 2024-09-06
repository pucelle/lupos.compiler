import type TS from 'typescript'
import {ts} from './global'
import {Visiting} from './visiting'
import {Helper} from './helper'
import {Scoping} from './scoping'
import {InterpolationContentType, Interpolator} from './interpolator'


/** Mark all variables with a context. */
export class Scope {

	readonly node: TS.FunctionLikeDeclaration | TS.ForStatement | TS.Block | TS.SourceFile
	readonly parent: Scope | null
	readonly visitingIndex: number

	/** All variables declared here. */
	private variables: Map<string, TS.Node | null> = new Map()

	constructor(
		node: TS.FunctionLikeDeclaration | TS.ForStatement | TS.Block | TS.SourceFile,
		index: number,
		parent: Scope | null
	) {
		this.node = node
		this.parent = parent
		this.visitingIndex = index
	}

	/** Visit a descendant node. */
	visitNode(node: TS.Node) {

		// Variable declaration.
		if (ts.isVariableDeclaration(node)) {
			for (let name of Helper.variable.walkDeclarationNames(node)) {
				this.variables.set(name, node)
			}
		}

		// Parameter.
		else if (ts.isParameter(node)) {
			this.variables.set(Helper.getText(node.name), node)
		}

		// `import {a as b}`,  `import {a}`
		else if (ts.isImportSpecifier(node)) {
			this.variables.set(Helper.getText(node.name), node)
		}

		// `import a`
		else if (ts.isImportClause(node)) {
			if (node.name) {
				this.variables.set(Helper.getText(node.name), node)
			}
		}

		// `import * as a`
		else if (ts.isNamespaceImport(node)) {
			this.variables.set(Helper.getText(node.name), node)
		}

		// Class or function declaration
		else if (ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) {
			if (node.name) {
				this.variables.set(Helper.getText(node.name), node)
			}
		}
	}

	/** Returns whether be top scope. */
	isTopmost(): boolean {
		return ts.isSourceFile(this.node)
	}

	/** Whether can add more statements inside. */
	canAddStatements(): boolean {
		return !Helper.isFunctionLike(this.node)
			&& !ts.isForStatement(this.node)
	}

	/** Whether has declared a specified named local variable. */
	hasLocalVariable(name: string): boolean {
		return this.variables.has(name)
	}

	/** Whether declared local variable as const. */
	isLocalVariableConstLike(name: string): boolean {
		if (!this.variables.has(name)) {
			return false
		}
		
		let node = this.variables.get(name)
		if (!node) {
			return false
		}

		if (ts.isVariableDeclaration(node)) {
			return (node.parent.flags & ts.NodeFlags.Const) > 0
		}
		else if (ts.isParameter(node)) {
			return false
		}

		// Imported, or function / class declaration
		else {
			return true
		}
	}

	/** Whether can visit a a variable by it's name. */
	canVisitVariable(name: string): boolean {
		if (this.variables.has(name)) {
			return true
		}

		if (this.parent) {
			return this.parent.canVisitVariable(name)
		}
		
		return false
	}

	/** Try get raw node by it's variable name. */
	getDeclarationByName(name: string): TS.Node | undefined {
		if (this.variables.has(name)) {
			return this.variables.get(name) ?? undefined
		}

		if (this.parent) {
			return this.parent.getDeclarationByName(name)
		}

		return undefined
	}

	/** 
	 * Add a non-repetitive variable name in scope,
	 * make it have no conflict with current scope, and ancestral scopes.
	 */
	makeUniqueVariable(prefix: string): string {
		let scope = this.findClosestScopeToAddStatements()
		let seed = 0
		let name = prefix + seed++

		while (scope.canVisitVariable(name)) {
			name = prefix + seed++
		}

		scope.variables.set(name, null)

		return name
	}

	/** 
	 * Add a variable to scope.
	 * If current scope can't add variables, choose parent scope.
	 * Several variable declarations will be stacked to a variable statement.
	 */
	addVariable(name: string) {
		let scope = this.findClosestScopeToAddStatements()
		Scoping.addVariableByScope(scope, name)
	}

	/** 
	 * Find an ancestral scope, and a child visiting index,
	 * which can insert variable before it.
	 */
	private findClosestScopeToAddStatements(): Scope {
		let scope: Scope = this

		while (!scope.canAddStatements()) {
			scope = scope.parent!
		}

		return scope
	}
	
	/** 
	 * Add statement to the beginning position of scope.
	 * If current scope can't add statements, choose parent scope.
	 * Several variable declarations will be stacked to a variable statement.
	 */
	addStatements(...stats: TS.Statement[]) {
		let scope = this.findClosestScopeToAddStatements()
		let toIndex = scope.getIndexToAddStatements()

		Interpolator.before(toIndex, InterpolationContentType.Declaration, () => stats)
	}

	/** Get best visiting index to add variable before it. */
	getIndexToAddStatements(): number {
		let toIndex = Visiting.getFirstChildIndex(this.visitingIndex)!

		// Insert before the first not import statements.
		if (this.isTopmost()) {
			let beforeNode = (this.node as TS.SourceFile).statements.find(n => !ts.isImportDeclaration(n))
			if (beforeNode) {
				toIndex = Visiting.getIndex(beforeNode)
			}
		}

		return toIndex
	}
}
