import { Component, html, CompiledTemplateResult, TemplateMaker, SlotPosition, HTMLMaker, TemplateSlot } from '@pucelle/lupos.js';
const $html_0 = new HTMLMaker("<!---->");
/*
<root>
    <template class="className" />
</root>
*/ const $template_0 = new TemplateMaker($context => {
    let $node = $html_0.make();
    let $node_0 = $node.content.firstChild;
    $context.el.classList.add("className");
    return {
        el: $node,
        position: new SlotPosition(2, $node_0)
    };
});
/*
<root>
    <template style="background-color: red" />
</root>
*/ const $template_1 = new TemplateMaker($context => {
    let $node = $html_0.make();
    let $node_0 = $node.content.firstChild;
    $context.el.style["background-color"] = "red";
    return {
        el: $node,
        position: new SlotPosition(2, $node_0)
    };
});
/*
<root>
    <template attr="value" />
</root>
*/ const $template_2 = new TemplateMaker($context => {
    let $node = $html_0.make();
    let $node_0 = $node.content.firstChild;
    $context.el.setAttribute("attr", "value");
    return {
        el: $node,
        position: new SlotPosition(2, $node_0)
    };
});
const $html_1 = new HTMLMaker("<div></div>");
/*
<root>
    <div />
</root>
*/ const $template_3 = new TemplateMaker($context => {
    let $node = $html_1.make();
    let $node_0 = $node.content.firstChild;
    return {
        el: $node,
        position: new SlotPosition(2, $node_0)
    };
});
const $html_2 = new HTMLMaker("<div><!----></div>");
/*
<root>
    <template attr="value">
        <div attr=${'value'}>
            ${html`<div />`}
        </div>
    </template>
</root>
*/ const $template_4 = new TemplateMaker($context => {
    let $node = $html_2.make();
    let $node_0 = $node.content.firstChild;
    let $node_1 = $node_0.firstChild;
    $context.el.setAttribute("attr", "value");
    let $slot_0 = new TemplateSlot(new SlotPosition(2, $node_1), $context, 0);
    $node_0.setAttribute("attr", 'value');
    $slot_0.update(new CompiledTemplateResult($template_3, []));
    return {
        el: $node,
        position: new SlotPosition(2, $node_0),
        parts: [$slot_0]
    };
});
class TestAttribute extends Component {
    testClass() {
        return new CompiledTemplateResult($template_0, []);
    }
    testStyle() {
        return new CompiledTemplateResult($template_1, []);
    }
    testAttr() {
        return new CompiledTemplateResult($template_2, []);
    }
    testContent() {
        return new CompiledTemplateResult($template_4, []);
    }
}