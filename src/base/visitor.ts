import type TS from 'typescript'
import {Visiting} from './visiting'
import {Interpolator} from './interpolator'
import {TransformerExtras} from 'ts-patch'
import {setGlobal, setSourceFile, setTransformContext} from './global'
import {Scoping} from './scoping'
import {Imports} from './imports'
import {runPostVisitCallbacks, runPreVisitCallbacks} from './visitor-callbacks'


/** 
 * It accepts a node,
 * can either return a function, which will be called after visited all children,
 * or return void to do nothing more.
 */
type VisitFunction = (node: TS.Node, index: number) => (() => void) | void


/** All defined visitors. */
const Visitors: VisitFunction[] = []


/** 
 * Define a visitor, and push it to visitor list.
 * `visit` will visit each node in depth-first order,
 * so you don't need to visit child nodes in each defined visitor.
 */
export function defineVisitor(visitor: VisitFunction) {
	Visitors.push(visitor)
}


/** 
 * Apply defined visitors to a node.
 * Returns a function, which will be called after visited all children.
 */
export function applyVisitors(node: TS.Node): () => void {
	let doMoreAfterVisitedChildren: Function[] = []
	let index = Visiting.getIndex(node)

	for (let visitor of Visitors) {
		let more = visitor(node, index)
		if (more) {
			doMoreAfterVisitedChildren.push(more)
		}
	}

	return () => {
		for (let fn of doMoreAfterVisitedChildren) {
			fn()
		}
	}
}


/** Transformer entry. */
export function transformer(program: TS.Program, extras: TransformerExtras) {
	let {ts} = extras
	setGlobal(program, extras)

	return (ctx: TS.TransformationContext) => {
		setTransformContext(ctx)

		return (sourceFile: TS.SourceFile) => {
			setSourceFile(sourceFile)
			runPreVisitCallbacks()

			function prepareVisit(node: TS.Node): TS.Node {
				Visiting.toNext(node)
				Scoping.toNext(node)

				Visiting.toChild()
				Scoping.toChild()

				ts.visitEachChild(node, prepareVisit, ctx)
				
				Visiting.toParent()
				Scoping.toParent()

				// Remember import members.
				if (ts.isImportSpecifier(node)) {
					Imports.add(node)
				}

				// Returned result has no matter.
				return node
			}

			function visit(node: TS.Node): TS.Node {
				let doMoreAfterVisitedChildren = applyVisitors(node)
				ts.visitEachChild(node, visit, ctx)
				doMoreAfterVisitedChildren()

				// Returned result has no matter.
				return node
			}

			try {
				ts.visitNode(sourceFile, prepareVisit)
				ts.visitNode(sourceFile, visit)
				runPostVisitCallbacks()

				return Interpolator.output(0) as TS.SourceFile
			}
			catch (err) {
				console.warn(`Failed to transform source file "${sourceFile.fileName}"!`)
				throw err
			}
		}
	}
}
