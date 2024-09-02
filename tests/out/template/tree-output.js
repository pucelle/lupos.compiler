import { Component, html, svg, TemplateMaker, SlotPosition, HTMLMaker, TemplateSlot, CompiledTemplateResult } from '@pucelle/lupos.js';
const $html_0 = new HTMLMaker("<!---->");
const $template_0 = new TemplateMaker($context => {
    let $node = $html_0.make();
    let $node_0 = $node.content.firstChild;
    $context.el.setAttribute("lass", "className");
    return {
        el: $node,
        position: new SlotPosition(2, $node_0)
    };
});
const $html_1 = new HTMLMaker("<svg><path></path></svg>", true);
const $template_1 = new TemplateMaker($context => {
    let $node = $html_1.make();
    let $node_0 = $node.content.firstChild;
    return {
        el: $node,
        position: new SlotPosition(2, $node_0)
    };
});
const $html_2 = new HTMLMaker("<svg><slot name=\"slotName\"></slot></svg>", true);
const $template_2 = new TemplateMaker($context => {
    let $node = $html_2.make();
    let $node_0 = $node.content.firstChild;
    let $slot_0 = new TemplateSlot(new SlotPosition(1, $node_0), $context);
    return {
        el: $node,
        position: new SlotPosition(2, $node_0),
        update($values) {
            $slot_0.update($context.__getSlotElement("name") ?? new CompiledTemplateResult($template_3, $values));
        },
        parts: [$slot_0]
    };
});
const $template_3 = new TemplateMaker($context => {
    let $node = $html_1.make();
    let $node_0 = $node.content.firstChild;
    return {
        el: $node,
        position: new SlotPosition(2, $node_0)
    };
});
class TestTemplateOutput extends Component {
    prop = 1;
    readonlyProp = 1;
    handleEvent() { }
    testTemplate() {
        return new CompiledTemplateResult($template_0, []);
    }
    testSVG() {
        return new CompiledTemplateResult($template_1, []);
    }
    testSVGContentSeparating() {
        return new CompiledTemplateResult($template_2, []);
    }
}
