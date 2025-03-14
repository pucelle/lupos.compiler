import * as ts from 'typescript'
import {Interpolator} from './interpolator'
import {setSourceFile, setTransformContext} from './global'
import {callVisitedSourceFileCallbacks, runPostVisitCallbacks, runPreVisitCallbacks} from './visitor-callbacks'
import {TransformerExtras} from '../../../compiler/out/patch'


/** 
 * It accepts a node,
 * can either return a function, which will be called after visited all children,
 * or return void to do nothing more.
 */
type VisitFunction = (node: ts.Node) => (() => void) | void


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
function applyVisitors(node: ts.Node): () => void {
	let doMoreAfterVisitedChildren: Function[] = []

	for (let visitor of Visitors) {
		let more = visitor(node)
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


/** Transformer entry, it will be call for each transformer. */
export function transformer(context: ts.TransformationContext, extras: TransformerExtras): ts.Transformer<ts.SourceFile> {
	setTransformContext(context, extras)

	return (sourceFile: ts.SourceFile) => {
		setSourceFile(sourceFile)
		runPreVisitCallbacks()

		function visitor(node: ts.Node): ts.Node {
			let doMoreAfterVisitedChildren = applyVisitors(node)
			ts.visitEachChild(node, visitor, context)
			doMoreAfterVisitedChildren()

			return node
		}

		try {
			ts.visitNode(sourceFile, visitor)
			callVisitedSourceFileCallbacks()
			runPostVisitCallbacks()

			return Interpolator.outputSelf(sourceFile) as ts.SourceFile
		}
		catch (err) {
			console.warn(`Failed to transform source file "${sourceFile.fileName}"!`)
			throw err
		}
	}
}
