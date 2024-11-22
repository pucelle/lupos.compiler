import type TS from 'typescript'
import {defineVisitor, ts} from '../../core'
import {TrackingScopeTree, TrackingScopeTypeMask} from './scope-tree'
import {AccessReferences} from './access-references'
import {TrackingPatch} from './patch'
import {TrackingRanges} from './ranges'


/** It add dependency tracking codes to source file. */
defineVisitor(function(node: TS.Node) {

	// Initialize
	if (ts.isSourceFile(node)) {
		TrackingScopeTree.init()
		TrackingRanges.init()
		AccessReferences.init()
		TrackingPatch.init()
	}

	// Check scope type.
	let ranges = TrackingRanges.getRangesByStartNode(node)
	if (ranges) {
		for (let range of ranges) {
			TrackingScopeTree.createScope(range.scopeType, node, range)
		}
	}

	// Check scope type.
	let type = TrackingScopeTree.checkType(node)
	if (type !== 0) {
		TrackingScopeTree.createScope(type, node)
	}
	
	// after visited children.
	return () => {
		TrackingScopeTree.visitNode(node)

		// Non content range type.
		if (type !== 0) {
			TrackingScopeTree.pop()
		}

		// If current scope is range type,
		// it get popped on when match range end node.
		while (TrackingScopeTree.current
			&& TrackingScopeTree.current.type & TrackingScopeTypeMask.Range
		) {
			if (node === TrackingScopeTree.current.range!.endNode) {
				TrackingScopeTree.pop()
			}
			else {
				break
			}
		}
	}
})