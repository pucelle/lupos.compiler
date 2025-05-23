import {definePostVisitCallback, definePreVisitCallback} from './visitor-callbacks'
import {diagnosticModifier, sourceFile, helper} from './global'
import {DiagnosticModifier} from '../lupos-ts-module'


// Diagnostic codes:
// https://github.com/microsoft/TypeScript/blob/v5.6.3/src/compiler/diagnosticMessages.json


export class ExtendedDiagnosticModifier extends DiagnosticModifier {

	constructor() {
		super(helper)
	}

	/** Output added and removed. */
	output() {
		for (let diag of this.added) {
			diagnosticModifier.add(diag)
		}

		for (let diag of this.deleted) {
			diagnosticModifier.delete(sourceFile.fileName, diag)
		}
	}
}


export let SourceFileDiagnosticModifier: ExtendedDiagnosticModifier

definePreVisitCallback(() => {
	diagnosticModifier.beforeVisitSourceFile(sourceFile)
	SourceFileDiagnosticModifier = new ExtendedDiagnosticModifier()
	SourceFileDiagnosticModifier.setSourceFile(sourceFile)
})

definePostVisitCallback(() => {
	SourceFileDiagnosticModifier.output()
})
