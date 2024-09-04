# lupos.compiler


## About

**lupos.compiler** is a Typescript Transformer helps to compile [lupos.js](https://github.com/pucelle/lupos.js) based projects.


## Features

- Compile `@computed`, `@effect`, `@watch` to no-decorator codes and track them.
- Insert codes like `trackGet(object, ...properties)` to track dependent properties.
- Insert codes like `trackSet(object, ...properties)` to notify tracked properties have changed.
- Compile html`...` and svg`...` to a compiled object.
- Compile sass like folded selector in css`...` to unfolded.
- Add a `static SlotContentType = xxx` property for component declarations to improve updating rendering performance.
- Optimize some binding codes.


## License

MIT