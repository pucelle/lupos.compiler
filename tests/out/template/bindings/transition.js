import { Component, fade, html, TransitionBinding, TemplateMaker, SlotPosition, HTMLMaker } from '@pucelle/lupos.js';
import { trackGet } from "@pucelle/ff";
const $html_0 = new HTMLMaker("<div></div>");
const $template_0 = new TemplateMaker($context => {
    let $node = $html_0.make();
    let $node_0 = $node.content.firstChild;
    let $binding_0 = new TransitionBinding($node_0, $context);
    return {
        el: $node,
        position: new SlotPosition(2, $node_0),
        update($values) {
            $binding_0.update($values[0]);
        },
        parts: [$binding_0]
    };
});
const $html_1 = new HTMLMaker("<div></div>");
const $template_1 = new TemplateMaker($context => {
    let $node = $html_1.make();
    let $node_0 = $node.content.firstChild;
    let $binding_0 = new TransitionBinding($node_0, $context);
    $binding_0.update(fade({ duration: 300 }));
    return {
        el: $node,
        position: new SlotPosition(2, $node_0),
        parts: [$binding_0]
    };
});
class TestTransitionBinding extends Component {
    duration = 300;
    testTransition() {
        trackGet(this, "duration");
        return new CompiledTemplateResult($template_0, [fade({ duration: this.duration })]);
    }
    testStaticTransition() {
        return new CompiledTemplateResult($template_1, []);
    }
}