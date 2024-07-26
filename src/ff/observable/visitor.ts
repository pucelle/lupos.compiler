import type TS from 'typescript'
import {defineVisitor, ts} from '../../base'
import {ContextTree} from './context-tree'
import {AccessReferences} from './access-references'
import {Hashing} from './hashing'


/** It add dependency tracking codes to source file. */
defineVisitor(function(node: TS.Node) {

	// Initialize
	if (ts.isSourceFile(node)) {
		ContextTree.initialize()
		AccessReferences.initialize()
		Hashing.initialize()
	}

	// Check contextual state, must after observable state pushing.
	let type = ContextTree.checkContextType(node)
	if (type !== 0) {
		ContextTree.createContext(type, node)
	}

	// after visited children.
	return () => {
		ContextTree.visitNode(node)

		if (type !== 0) {
			ContextTree.pop()
		}
	}
})